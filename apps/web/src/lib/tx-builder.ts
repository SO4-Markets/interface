/**
 * apps/web/src/lib/tx-builder.ts
 *
 * Submit a signed Soroban transaction and poll until confirmed.
 *
 * Both stellar.ts (trade) and earn.ts call sendAndPoll() once contracts
 * are deployed — replacing the current fakeTxDelay() stubs.
 *
 * Polling strategy: exponential backoff (1 s → 2 s → 4 s → 8 s capped).
 * Default maximum wait: 30 s (configurable per call).
 *
 * Throws:
 *   TxFailedError   — on-chain execution returned FAILED status;
 *                     carries Soroban diagnostic events where available.
 *   TxTimeoutError  — transaction still NOT_FOUND after timeoutMs.
 */

import { TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk"
import { NETWORK } from "../app/config/network"

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when the network confirmed the transaction but execution failed.
 * `diagnosticEvents` contains the Soroban diagnostic event XDR objects
 * extracted from the result meta (TransactionMetaV3.sorobanMeta).
 */
export class TxFailedError extends Error {
  constructor(
    /** Transaction hash. May be empty string when the error occurs before broadcast. */
    public readonly hash: string,
    /** Soroban diagnostic events (xdr.DiagnosticEvent[]) or raw fallback. */
    public readonly diagnosticEvents: unknown[],
  ) {
    super(`Transaction ${hash} failed on-chain`)
    this.name = "TxFailedError"
  }
}

/**
 * Thrown when the transaction has not reached a terminal state
 * (SUCCESS or FAILED) within the configured timeout window.
 */
export class TxTimeoutError extends Error {
  constructor(
    public readonly hash: string,
    public readonly timeoutMs: number,
  ) {
    super(`Transaction ${hash} not confirmed within ${timeoutMs} ms`)
    this.name = "TxTimeoutError"
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export type TxResult = {
  status: "SUCCESS"
  hash: string
  /**
   * The contract return value as an xdr.ScVal, or null for non-Soroban
   * transactions. Use `scValToNative(result)` to convert to a JS value.
   */
  result: xdr.ScVal | null
}

export type SendAndPollOptions = {
  /**
   * Maximum milliseconds to wait for confirmation.
   * @default 30_000
   */
  timeoutMs?: number
}

/**
 * Submit a signed-XDR transaction to Soroban RPC and poll until confirmed.
 *
 * ```ts
 * const { hash, result } = await sendAndPoll(signedXdr)
 * const value = scValToNative(result)    // only if result is non-null
 * ```
 *
 * @param signedXdr  Base64-encoded XDR of the signed TransactionEnvelope.
 * @param options    Optional overrides (e.g. `{ timeoutMs: 60_000 }`).
 *
 * @throws {TxFailedError}   On-chain execution status was FAILED.
 * @throws {TxTimeoutError}  Transaction still NOT_FOUND after `timeoutMs`.
 */
export async function sendAndPoll(
  signedXdr: string,
  options?: SendAndPollOptions,
): Promise<TxResult> {
  const timeoutMs = options?.timeoutMs ?? 30_000
  const server = new rpc.Server(NETWORK.rpcUrl)

  // Parse XDR → Transaction / FeeBumpTransaction
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK.networkPassphrase)

  // ── Submit ─────────────────────────────────────────────────────────────────
  const sendResult = await server.sendTransaction(tx)

  if (sendResult.status === "ERROR") {
    // Immediate rejection by the RPC node (bad XDR, insufficient fee, etc.)
    throw new TxFailedError(
      sendResult.hash,
      sendResult.diagnosticEvents ?? [],
    )
  }

  if (sendResult.status === "TRY_AGAIN_LATER") {
    // RPC is overloaded; caller should back off and re-submit
    throw new Error(
      "RPC node is overloaded (TRY_AGAIN_LATER). Please retry shortly.",
    )
  }

  // "PENDING" | "DUPLICATE" — hash is valid, proceed to poll
  const { hash } = sendResult
  const deadline = Date.now() + timeoutMs

  // ── Poll with exponential backoff ─────────────────────────────────────────
  //   1 s → 2 s → 4 s → 8 s (cap), never sleeping past the deadline

  let delay = 1_000
  const MAX_DELAY = 8_000

  while (Date.now() < deadline) {
    await sleep(Math.min(delay, deadline - Date.now()))
    delay = Math.min(delay * 2, MAX_DELAY)

    const poll = await server.getTransaction(hash)

    if (poll.status === "SUCCESS") {
      return {
        status: "SUCCESS",
        hash,
        // returnValue is xdr.ScVal | undefined; undefined for non-Soroban txns
        result: poll.returnValue ?? null,
      }
    }

    if (poll.status === "FAILED") {
      throw new TxFailedError(hash, extractDiagnosticEvents(poll.resultMetaXdr))
    }

    // "NOT_FOUND" — ledger hasn't closed yet; keep polling
  }

  throw new TxTimeoutError(hash, timeoutMs)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract Soroban diagnostic events from a TransactionMeta XDR object.
 *
 * Only TransactionMetaV3 (Soroban) carries diagnostic events via
 * `v3().sorobanMeta().diagnosticEvents()`.  V1/V2 (classic) metas throw
 * when `.v3()` is called — the catch returns an empty array in that case.
 */
function extractDiagnosticEvents(
  meta: xdr.TransactionMeta | undefined,
): unknown[] {
  if (!meta) return []
  try {
    return meta.v3().sorobanMeta()?.diagnosticEvents() ?? []
  } catch {
    // Meta is V1 or V2 (classic transaction) — no diagnostic events
    return []
  }
}
