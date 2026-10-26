/**
 * apps/web/src/lib/soroban/events.ts
 *
 * Contract event query helpers for Soroban.
 *
 * Wraps the Soroban RPC `getEvents` method and exposes a clean typed
 * interface.  Using the singleton `sorobanRpc` client means all HTTP
 * traffic goes through the shared RPC URL and is fully interceptable by
 * MSW in tests.
 *
 * The SDK parses raw base64-XDR `topic` / `value` fields into `xdr.ScVal`
 * objects on the returned `EventResponse`.  Callers can use
 * `xdr.ScVal.switch()` / `.value()` or the higher-level helpers from
 * `@stellar/stellar-sdk` to decode them further.
 */

import { sorobanRpc } from "./client"
import type { rpc as StellarRpc, xdr } from "@stellar/stellar-sdk/minimal"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-parsed Soroban contract event (topics and value decoded from XDR). */
export type ContractEvent = {
  id: string
  type: StellarRpc.Api.EventType
  ledger: number
  ledgerClosedAt: string
  txHash: string
  contractId: string
  /** Decoded ScVal topics */
  topics: Array<xdr.ScVal>
  /** Decoded ScVal value */
  value: xdr.ScVal
}

/** Result of a single `queryContractEvents` call. */
export type ContractEventsPage = {
  events: Array<ContractEvent>
  /**
   * Opaque cursor string for pagination.  Pass to the next call as `cursor`
   * to fetch the following page.  Empty string when the result set is empty.
   */
  cursor: string
  latestLedger: number
}

export type QueryContractEventsOptions = {
  /** Contract ID (C... address) to filter by. */
  contractId: string
  /** Topic filters (array of ScVal arrays encoded as base64 XDR strings). */
  topicFilters?: Array<Array<string>>
  /**
   * Ledger range mode: start from this ledger.
   * Mutually exclusive with `cursor`.
   */
  startLedger?: number
  /**
   * Cursor pagination mode: continue from a previous page's cursor.
   * Mutually exclusive with `startLedger`.
   */
  cursor?: string
  /** Max events to return (default: 20). */
  limit?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toContractEvent(raw: StellarRpc.Api.EventResponse): ContractEvent {
  return {
    id: raw.id,
    type: raw.type,
    ledger: raw.ledger,
    ledgerClosedAt: raw.ledgerClosedAt,
    txHash: raw.txHash,
    // The SDK sets contractId as a Contract instance when present;
    // `contractId()` already returns the C… string form.
    contractId: raw.contractId?.contractId() ?? "",
    topics: raw.topic,
    value: raw.value,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query contract events from Soroban RPC.
 *
 * Supply either `startLedger` (ledger-range mode) or `cursor` (pagination
 * mode) — never both.
 *
 * @example
 * // First page from ledger 1000
 * const page = await queryContractEvents({
 *   contractId: "CAAA...",
 *   startLedger: 1000,
 *   limit: 50,
 * })
 *
 * // Next page using cursor
 * if (page.cursor) {
 *   const next = await queryContractEvents({
 *     contractId: "CAAA...",
 *     cursor: page.cursor,
 *     limit: 50,
 *   })
 * }
 */
export async function queryContractEvents(
  options: QueryContractEventsOptions,
): Promise<ContractEventsPage> {
  const limit = options.limit ?? 20

  const filter: StellarRpc.Api.EventFilter = {
    type: "contract",
    contractIds: [options.contractId],
    ...(options.topicFilters ? { topics: options.topicFilters } : {}),
  }

  const request: StellarRpc.Api.GetEventsRequest = options.cursor
    ? { filters: [filter], cursor: options.cursor, limit }
    : { filters: [filter], startLedger: options.startLedger ?? 1, limit }

  const response = await sorobanRpc.getEvents(request)

  return {
    events: response.events.map(toContractEvent),
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  }
}
