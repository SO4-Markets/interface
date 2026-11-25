import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HttpResponse, http } from "msw"
import { server } from "../../test/msw/server"
import { TxFailedError, TxTimeoutError, sendAndPoll } from "./tx-builder"
import { OFFLINE_TRANSACTION_MESSAGE } from "@/shared/lib/network-safety"

// ─────────────────────────────────────────────────────────────────────────────
// Pre-generated signed XDR (manageData op, testnet passphrase).
// Built offline via Keypair.random() + TransactionBuilder — avoids needing
// crypto.getRandomValues in the vitest / happy-dom test environment.
// ─────────────────────────────────────────────────────────────────────────────

const signedXdr =
  "AAAAAgAAAACJlUQe5rIfK+y/H5Qf1HaXezVeHd4V/ir73+ZPR3C9LAAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABqY8x5AAAAAAAAAAEAAAAAAAAACgAAAAR0ZXN0AAAAAQAAAAR0ZXN0AAAAAAAAAAFHcL0sAAAAQMRdV8y7Wp7XD6PKmw13QyEylYLN/0uwVLmFB5lr3whkm2nwfCQc/6zN187UEcnnO+PAV0P7/CxHCOaZqkWhogI="

// Minimal valid XDR for getTransaction SUCCESS/FAILED responses.
// The SDK's parseTransactionInfo() expects envelopeXdr, resultXdr, and
// resultMetaXdr as base64 strings — these are minimal valid encodings.
const resultXdr = "AAAAAAAAAGQAAAAAAAAAAAAAAAA=" // TransactionResult (20 bytes)
const resultMetaXdr = "AAAAAAAAAAA="              // TransactionMeta v0 (8 bytes)

// ─────────────────────────────────────────────────────────────────────────────
// MSW handler helper — routes JSON-RPC by method
// ─────────────────────────────────────────────────────────────────────────────

type RpcBody = { id?: string | number; method?: string }

function rpcHandler(
  routes: Partial<Record<string, (body: RpcBody) => object>>,
) {
  return http.post("https://soroban-testnet.stellar.org", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as RpcBody
    const handler = routes[body.method ?? ""]
    if (handler !== undefined) {
      return HttpResponse.json({
        jsonrpc: "2.0",
        id: body.id ?? 1,
        result: handler(body),
      })
    }
    return HttpResponse.json({ jsonrpc: "2.0", id: body.id ?? 1, result: {} })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive an async promise while advancing fake timers.
// 交替 flush microtasks and advance timers so both fetch (MSW) and setTimeout
// (polling sleep) resolve.
// ─────────────────────────────────────────────────────────────────────────────

async function drive<T>(promise: Promise<T>): Promise<T> {
  const state = { settled: false, resolvedValue: undefined as T | undefined, rejectedError: undefined as unknown }

  promise.then(
    (v) => { state.settled = true; state.resolvedValue = v },
    (e) => { state.settled = true; state.rejectedError = e },
  )

  for (let i = 0; i < 50; i++) {
    if (state.settled) break
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(10_000)
    await Promise.resolve()
  }

  await Promise.resolve()
  if (state.rejectedError !== undefined) throw state.rejectedError
  return state.resolvedValue as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("sendAndPoll", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  })

  it("does not broadcast a signed transaction while the browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })

    await expect(sendAndPoll(signedXdr)).rejects.toThrow(OFFLINE_TRANSACTION_MESSAGE)
  })

  it("returns hash and status on successful round-trip", async () => {
    const hash = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaabbbbccccddddeeee"

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "PENDING", hash }),
        getTransaction: () => ({
          status: "SUCCESS",
          hash,
          envelopeXdr: signedXdr,
          resultXdr,
          resultMetaXdr,
        }),
      }),
    )

    const result = await drive(sendAndPoll(signedXdr, { timeoutMs: 5_000 }))

    expect(result.status).toBe("SUCCESS")
    expect(result.hash).toBe(hash)
  })

  it("handles DUPLICATE status from send and resolves via poll", async () => {
    const hash = "dup0000000000000000000000000000000000000000000000000000000000"

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "DUPLICATE", hash }),
        getTransaction: () => ({
          status: "SUCCESS",
          hash,
          envelopeXdr: signedXdr,
          resultXdr,
          resultMetaXdr,
        }),
      }),
    )

    const result = await drive(sendAndPoll(signedXdr, { timeoutMs: 5_000 }))

    expect(result.status).toBe("SUCCESS")
    expect(result.hash).toBe(hash)
  })

  it("returns null result when returnValue is absent in meta", async () => {
    const hash = "noresult0000000000000000000000000000000000000000000000000000"

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "PENDING", hash }),
        getTransaction: () => ({
          status: "SUCCESS",
          hash,
          envelopeXdr: signedXdr,
          resultXdr,
          resultMetaXdr,
        }),
      }),
    )

    const result = await drive(sendAndPoll(signedXdr, { timeoutMs: 5_000 }))

    expect(result.status).toBe("SUCCESS")
    expect(result.result).toBeNull()
  })

  it("throws TxFailedError when sendTransaction returns ERROR", async () => {
    const hash = "err00000000000000000000000000000000000000000000000000000000"

    server.use(
      rpcHandler({
        sendTransaction: () => ({
          status: "ERROR",
          hash,
          diagnosticEvents: [],
        }),
      }),
    )

    let err: unknown
    try {
      await drive(sendAndPoll(signedXdr))
    } catch (e) { err = e }
    expect(err).toBeInstanceOf(TxFailedError)
    expect((err as TxFailedError).hash).toBe(hash)
    expect((err as TxFailedError).message).toContain(hash)
  })

  it("throws when sendTransaction returns TRY_AGAIN_LATER", async () => {
    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "TRY_AGAIN_LATER", hash: "" }),
      }),
    )

    await expect(drive(sendAndPoll(signedXdr))).rejects.toThrow("TRY_AGAIN_LATER")
  })

  it("throws TxTimeoutError with hash and timeoutMs when poll never resolves", async () => {
    const hash = "timeout000000000000000000000000000000000000000000000000000000"
    const timeoutMs = 500

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "PENDING", hash }),
        getTransaction: () => ({ status: "NOT_FOUND", hash }),
      }),
    )

    let err: unknown
    try {
      await drive(sendAndPoll(signedXdr, { timeoutMs }))
    } catch (e) { err = e }
    expect(err).toBeInstanceOf(TxTimeoutError)
    expect((err as TxTimeoutError).hash).toBe(hash)
    expect((err as TxTimeoutError).timeoutMs).toBe(timeoutMs)
    expect((err as TxTimeoutError).message).toContain(hash)
  })

  it("throws TxFailedError when poll returns FAILED", async () => {
    const hash = "fail000000000000000000000000000000000000000000000000000000000"

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "PENDING", hash }),
        getTransaction: () => ({
          status: "FAILED",
          hash,
          envelopeXdr: signedXdr,
          resultXdr,
          resultMetaXdr,
        }),
      }),
    )

    let err: unknown
    try {
      await drive(sendAndPoll(signedXdr, { timeoutMs: 5_000 }))
    } catch (e) { err = e }
    expect(err).toBeInstanceOf(TxFailedError)
    expect((err as TxFailedError).hash).toBe(hash)
    expect((err as TxFailedError).message).toContain("failed")
  })

  it("polls multiple times before success", async () => {
    const hash = "multi000000000000000000000000000000000000000000000000000000"
    let pollCount = 0

    server.use(
      rpcHandler({
        sendTransaction: () => ({ status: "PENDING", hash }),
        getTransaction: () => {
          pollCount++
          if (pollCount < 3) {
            return { status: "NOT_FOUND", hash }
          }
          return {
            status: "SUCCESS",
            hash,
            envelopeXdr: signedXdr,
            resultXdr,
            resultMetaXdr,
          }
        },
      }),
    )

    const result = await drive(sendAndPoll(signedXdr, { timeoutMs: 30_000 }))

    expect(result.status).toBe("SUCCESS")
    expect(result.hash).toBe(hash)
    expect(pollCount).toBe(3)
  })
})
