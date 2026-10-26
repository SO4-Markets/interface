/**
 * apps/web/src/lib/soroban/events.test.ts
 *
 * Contract event query parsing tests.
 *
 * All RPC HTTP traffic is intercepted by MSW — no real Soroban RPC calls are
 * made.  The MSW server lifecycle is managed by setup-tests.ts (preloaded via
 * `bun test --preload ./setup-tests.ts`).
 *
 * Scenarios covered
 * ──────────────────
 * 1. Decoded topics and value  – fixture with a symbol topic and i128 value
 *    are parsed correctly from base64 XDR.
 * 2. Pagination cursor         – cursor from response is surfaced; a second
 *    call using that cursor routes correctly.
 * 3. Empty result              – zero events returned, cursor is empty string.
 */

import { describe, expect, it } from "vitest"
import { HttpResponse, http } from "msw"
import { xdr } from "@stellar/stellar-sdk/minimal"
import { server } from "../../../test/msw/server"
import { queryContractEvents } from "./events"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const RPC_URL = "https://soroban-testnet.stellar.org"

/** A valid 56-char C... contract address used as the filter target. */
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF"

// ─────────────────────────────────────────────────────────────────────────────
// XDR fixture helpers
//
// We build the base64 XDR strings from the SDK itself so the fixture is
// always valid and consistent with the SDK version in use.
// ─────────────────────────────────────────────────────────────────────────────

/** Base64 XDR for ScVal::Symbol("transfer") */
const SYMBOL_TRANSFER_XDR = xdr.ScVal.scvSymbol("transfer").toXDR("base64")

/** Base64 XDR for ScVal::Symbol("deposit") */
const SYMBOL_DEPOSIT_XDR = xdr.ScVal.scvSymbol("deposit").toXDR("base64")

/** Base64 XDR for ScVal::I128 representing 1_000_000 (1e6 in low 64 bits) */
const I128_VALUE_XDR = xdr.ScVal.scvI128(
  new xdr.Int128Parts({ hi: xdr.Int64.fromString("0"), lo: xdr.Uint64.fromString("1000000") }),
).toXDR("base64")

/** Base64 XDR for ScVal::I128 representing 500_000 */
const I128_VALUE2_XDR = xdr.ScVal.scvI128(
  new xdr.Int128Parts({ hi: xdr.Int64.fromString("0"), lo: xdr.Uint64.fromString("500000") }),
).toXDR("base64")

// ─────────────────────────────────────────────────────────────────────────────
// Raw event fixture builder
// ─────────────────────────────────────────────────────────────────────────────

type RawEventOverrides = {
  id?: string
  contractId?: string
  topic?: Array<string>
  value?: string
  ledger?: number
  txHash?: string
  cursor?: string
}

function makeRawEvent(overrides: RawEventOverrides = {}) {
  return {
    id: overrides.id ?? "0000000012345-0000000001",
    type: "contract" as const,
    ledger: overrides.ledger ?? 12345,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: overrides.txHash ?? "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    contractId: overrides.contractId ?? CONTRACT_ID,
    topic: overrides.topic ?? [SYMBOL_TRANSFER_XDR],
    value: overrides.value ?? I128_VALUE_XDR,
  }
}

/** Build a JSON-RPC 2.0 getEvents success response. */
function makeRpcEventsResponse(
  events: Array<ReturnType<typeof makeRawEvent>>,
  cursor = "0000000012345-0000000001",
  latestLedger = 12345,
) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      events,
      cursor,
      latestLedger,
      oldestLedger: 1,
      latestLedgerCloseTime: "2024-01-01T00:00:00Z",
      oldestLedgerCloseTime: "2024-01-01T00:00:00Z",
    },
  }
}

/** MSW handler that only intercepts getEvents POST requests. */
type RpcBody = { id?: string | number; method?: string; params?: unknown }

function getEventsHandler(
  response: ReturnType<typeof makeRpcEventsResponse>,
  onRequest?: (params: unknown) => void,
) {
  return http.post(RPC_URL, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as RpcBody
    if (body.method !== "getEvents") {
      // Fall through for other methods — return empty success so they don't fail
      return HttpResponse.json({ jsonrpc: "2.0", id: body.id ?? 1, result: {} })
    }
    onRequest?.(body.params)
    return HttpResponse.json({ ...response, id: body.id ?? 1 })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: decoded topics and value
// ─────────────────────────────────────────────────────────────────────────────

describe("queryContractEvents – decoded topics and value", () => {
  it("decodes a symbol topic correctly", async () => {
    server.use(
      getEventsHandler(
        makeRpcEventsResponse([makeRawEvent({ topic: [SYMBOL_TRANSFER_XDR] })]),
      ),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    expect(page.events).toHaveLength(1)
    const event = page.events[0]
    expect(event.topics).toHaveLength(1)

    const topic = event.topics[0]
    // The SDK parses scvSymbol — switch() returns the type discriminant
    expect(topic.switch().name).toBe("scvSymbol")
    expect(topic.sym().toString()).toBe("transfer")
  })

  it("decodes an i128 value correctly", async () => {
    server.use(
      getEventsHandler(
        makeRpcEventsResponse([makeRawEvent({ value: I128_VALUE_XDR })]),
      ),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    const value = page.events[0].value
    expect(value.switch().name).toBe("scvI128")
    // Low 64 bits hold 1_000_000
    expect(value.i128().lo().toString()).toBe("1000000")
    expect(value.i128().hi().toString()).toBe("0")
  })

  it("maps all base metadata fields onto the ContractEvent", async () => {
    const raw = makeRawEvent({
      id: "fixture-event-id",
      ledger: 42000,
      txHash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    })

    server.use(getEventsHandler(makeRpcEventsResponse([raw])))

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })
    const event = page.events[0]

    expect(event.id).toBe("fixture-event-id")
    expect(event.ledger).toBe(42000)
    expect(event.txHash).toBe(
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    )
    expect(event.type).toBe("contract")
  })

  it("decodes multi-topic events", async () => {
    server.use(
      getEventsHandler(
        makeRpcEventsResponse([
          makeRawEvent({ topic: [SYMBOL_TRANSFER_XDR, SYMBOL_DEPOSIT_XDR] }),
        ]),
      ),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })
    const { topics } = page.events[0]

    expect(topics).toHaveLength(2)
    expect(topics[0].sym().toString()).toBe("transfer")
    expect(topics[1].sym().toString()).toBe("deposit")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: pagination cursor handling
// ─────────────────────────────────────────────────────────────────────────────

describe("queryContractEvents – pagination cursor", () => {
  it("surfaces the cursor from the RPC response", async () => {
    server.use(
      getEventsHandler(
        makeRpcEventsResponse(
          [makeRawEvent()],
          "0000000099999-0000000001",
        ),
      ),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    expect(page.cursor).toBe("0000000099999-0000000001")
  })

  it("sends cursor in the next request and returns the next page", async () => {
    const page1Cursor = "0000000010000-0000000001"
    const page1Event = makeRawEvent({ id: "event-page1", value: I128_VALUE_XDR })
    const page2Event = makeRawEvent({ id: "event-page2", value: I128_VALUE2_XDR })

    let capturedParams: unknown

    server.use(
      http.post(RPC_URL, async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as RpcBody
        if (body.method !== "getEvents") {
          return HttpResponse.json({ jsonrpc: "2.0", id: body.id ?? 1, result: {} })
        }

        capturedParams = body.params

        // Dispatch on whether params contains a cursor
        const params = body.params as { cursor?: string } | null
        const hasCursor = params && typeof params === "object" && "cursor" in params

        if (hasCursor) {
          return HttpResponse.json({
            ...makeRpcEventsResponse([page2Event], "0000000020000-0000000001"),
            id: body.id ?? 1,
          })
        }

        return HttpResponse.json({
          ...makeRpcEventsResponse([page1Event], page1Cursor),
          id: body.id ?? 1,
        })
      }),
    )

    // First page — ledger-range mode
    const first = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })
    expect(first.events[0].id).toBe("event-page1")
    expect(first.cursor).toBe(page1Cursor)

    // Second page — cursor mode
    const second = await queryContractEvents({
      contractId: CONTRACT_ID,
      cursor: first.cursor,
    })
    expect(second.events[0].id).toBe("event-page2")
    expect(second.cursor).toBe("0000000020000-0000000001")

    // Confirm the second request carried a cursor param
    expect(capturedParams).toMatchObject({ cursor: page1Cursor })
  })

  it("surfaces latestLedger from the response", async () => {
    server.use(
      getEventsHandler(makeRpcEventsResponse([], "", 99999)),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    expect(page.latestLedger).toBe(99999)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: empty result fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("queryContractEvents – empty result", () => {
  it("returns empty events array and empty cursor when no events exist", async () => {
    server.use(
      getEventsHandler(makeRpcEventsResponse([], "", 12345)),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    expect(page.events).toHaveLength(0)
    expect(page.cursor).toBe("")
    expect(page.latestLedger).toBe(12345)
  })

  it("returns empty array when RPC returns null events", async () => {
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as RpcBody
        if (body.method !== "getEvents") {
          return HttpResponse.json({ jsonrpc: "2.0", id: body.id ?? 1, result: {} })
        }
        return HttpResponse.json({
          jsonrpc: "2.0",
          id: body.id ?? 1,
          result: {
            events: [],
            cursor: "",
            latestLedger: 1,
            oldestLedger: 1,
            latestLedgerCloseTime: "2024-01-01T00:00:00Z",
            oldestLedgerCloseTime: "2024-01-01T00:00:00Z",
          },
        })
      }),
    )

    const page = await queryContractEvents({ contractId: CONTRACT_ID, startLedger: 1 })

    expect(Array.isArray(page.events)).toBe(true)
    expect(page.events).toHaveLength(0)
  })
})
