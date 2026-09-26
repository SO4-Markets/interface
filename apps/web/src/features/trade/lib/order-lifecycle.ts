/**
 * apps/web/src/features/trade/lib/order-lifecycle.ts
 *
 * Order lifecycle vocabulary for the account UI (OB-082).
 *
 * The indexer stores order status as an uppercase event-derived string
 * (`CREATED`, `UPDATED`, `FROZEN`, `EXECUTED`, `CANCELLED`). The UI previously
 * compared against lowercase literals, so frozen and executed orders silently
 * rendered as "active". Everything funnels through `normalizeOrderStatus` here
 * so casing can never decide what a trader sees again.
 *
 * Status alone is still not enough to describe a row: an order the indexer has
 * not picked up yet, an order the trader has asked to cancel, and an order that
 * has taken a partial fill each need their own visible state.
 */

import type { StatusVariant } from "@workspace/ui/components/status-badge"
import type { OrderStatus, OrderType } from "../hooks/useOrders"

/** Every order type the app can construct, in one place. */
export const KNOWN_ORDER_TYPES: ReadonlyArray<OrderType> = [
  "MarketIncrease",
  "LimitIncrease",
  "MarketDecrease",
  "LimitDecrease",
  "StopLossDecrease",
  "MarketSwap",
  "LimitSwap",
]

const ORDER_TYPE_BY_LOWER_CASE = new Map<string, OrderType>(
  KNOWN_ORDER_TYPES.map((type) => [type.toLowerCase(), type]),
)

/**
 * Map an indexer-supplied `orderType` string onto a type the UI can switch on.
 *
 * The indexer stores whatever the event carried, so an unrecognised value must
 * degrade gracefully instead of leaking an arbitrary string into typed code.
 */
export function toKnownOrderType(raw: string, fallback: OrderType = "MarketIncrease"): OrderType {
  return ORDER_TYPE_BY_LOWER_CASE.get(raw.trim().toLowerCase()) ?? fallback
}

export type OrderLifecycleStage =
  /** Submitted and authoritatively confirmed, waiting for the indexer. */
  | "pending"
  /** Resting and executable. */
  | "accepted"
  /** Has at least one executed fill while the original size is not exhausted. */
  | "partially-filled"
  /** Order execution is frozen by the contract. */
  | "frozen"
  /** Cancellation submitted and awaiting authoritative confirmation. */
  | "pending-cancellation"
  /** Original size fully accounted for by executed fills. */
  | "filled"
  /** Cancelled (by the trader or the contract). */
  | "cancelled"

export type OrderLifecycleInput = {
  status: OrderStatus | string
  /** True while a confirmed order has not appeared in indexed data yet. */
  awaitingIndex?: boolean
  /** True while a cancellation transaction is in flight for this order. */
  pendingCancellation?: boolean
  /** Order size as submitted (USD). */
  originalSizeUsd?: number
  /** Sum of executed fills applied to this order (USD). */
  filledSizeUsd?: number
}

export const ORDER_LIFECYCLE_LABEL: Record<OrderLifecycleStage, string> = {
  pending: "Pending index",
  accepted: "Open",
  "partially-filled": "Partially filled",
  frozen: "Frozen",
  "pending-cancellation": "Cancelling",
  filled: "Filled",
  cancelled: "Cancelled",
}

export const ORDER_LIFECYCLE_BADGE: Record<OrderLifecycleStage, StatusVariant> = {
  pending: "info-subtle",
  accepted: "neutral",
  "partially-filled": "info",
  frozen: "warning",
  "pending-cancellation": "warning",
  filled: "success",
  cancelled: "muted",
}

/** Machine-readable meaning of the raw `status` string, casing-insensitive. */
export type NormalizedOrderStatus =
  | "created"
  | "updated"
  | "frozen"
  | "executed"
  | "cancelled"
  | "unknown"

export function normalizeOrderStatus(status: string): NormalizedOrderStatus {
  switch (status.trim().toLowerCase()) {
    case "created":
      return "created"
    case "updated":
      return "updated"
    case "frozen":
      return "frozen"
    case "executed":
      return "executed"
    case "cancelled":
    case "canceled":
      return "cancelled"
    default:
      return "unknown"
  }
}

/** Floating-point slack when comparing USD sizes for exact fill. */
const SIZE_EPSILON = 1e-9

/**
 * Derive the stage a row should present.
 *
 * Invariant: an order is only reported as `filled` when its original size is
 * fully accounted for by executed fills — a partially filled order must never
 * be presented as if its unfilled remainder executed (OB-087).
 */
export function deriveOrderLifecycleStage(
  input: OrderLifecycleInput,
): OrderLifecycleStage {
  const awaitingIndex = input.awaitingIndex ?? false
  const pendingCancellation = input.pendingCancellation ?? false
  const original = input.originalSizeUsd ?? 0
  const filled = input.filledSizeUsd ?? 0

  const normalized = normalizeOrderStatus(input.status)

  if (awaitingIndex || normalized === "unknown") {
    // We have no authoritative record yet; the last thing we may claim is that
    // a submitted transaction confirmed on the ledger.
    return "pending"
  }

  if (normalized === "cancelled") return "cancelled"

  const hasSizeInfo = original > 0
  const fullyFilled = hasSizeInfo && filled >= original - SIZE_EPSILON

  if (fullyFilled) return "filled"
  if (pendingCancellation) return "pending-cancellation"
  if (normalized === "frozen") return "frozen"
  if (filled > 0) return "partially-filled"
  // An order status alone does not establish an executed quantity. The fill
  // records are authoritative for size, so an unlinked/zero-fill order must
  // not be presented as filled.
  if (normalized === "executed" && filled > 0) return "filled"

  return "accepted"
}

const CANCELLABLE_STAGES: ReadonlySet<OrderLifecycleStage> = new Set<
  OrderLifecycleStage
>(["accepted", "partially-filled", "frozen"])

/** Stages where a Cancel action can still change the outcome. */
export function isCancellableStage(stage: OrderLifecycleStage): boolean {
  return CANCELLABLE_STAGES.has(stage)
}

/** True while a row should present the cancellation as in flight. */
export function isPendingCancellationStage(stage: OrderLifecycleStage): boolean {
  return stage === "pending-cancellation"
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable row identity
// ─────────────────────────────────────────────────────────────────────────────

export type OrderRowIdentity = {
  /** Authoritative indexer key. Empty while the order is only client-side. */
  key: string
  /** Client-generated id that survives the indexer assigning a real key. */
  clientOrderId?: string
}

/**
 * Row key used for React reconciliation.
 *
 * A pending order starts life with no authoritative key. Once the indexer
 * assigns one, the identity must not change — otherwise the row remounts, the
 * table jumps, and focus is lost mid-refresh (OB-082).
 */
export function orderRowKey(row: OrderRowIdentity): string {
  return row.clientOrderId ?? row.key
}

/**
 * Re-order `incoming` so rows that already existed keep their relative
 * position, and genuinely new rows append. Combined with a stable
 * `orderRowKey`, a background refresh cannot reorder rows under the pointer.
 */
export function mergeOrderRowsByIdentity<T extends OrderRowIdentity>(
  previous: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
): Array<T> {
  if (previous.length === 0) return [...incoming]

  const previousPositions = new Map<string, number>()
  previous.forEach((row, index) => {
    previousPositions.set(orderRowKey(row), index)
  })

  // Array.prototype.sort is stable, so rows with no previous position keep
  // their incoming order.
  return [...incoming].sort((a, b) => {
    const aIndex = previousPositions.get(orderRowKey(a))
    const bIndex = previousPositions.get(orderRowKey(b))
    if (aIndex === undefined && bIndex === undefined) return 0
    if (aIndex === undefined) return 1
    if (bIndex === undefined) return -1
    return aIndex - bIndex
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending (submitted but not yet indexed) orders
// ─────────────────────────────────────────────────────────────────────────────

export type PendingOrderLike = {
  clientOrderId: string
  marketAddress: string
  orderType: string
  isLong: boolean
  sizeUsd: number
  submittedAt: number
}

export type IndexedOrderLike = {
  key: string
  clientOrderId?: string
  marketAddress: string
  orderType: string
  isLong: boolean
  sizeUsd: number
  /** When the indexer first saw the order (ms). */
  createdAt?: number | null
  /** Last indexer-side update (ms). */
  updatedAt?: number | null
}

const SIZE_MATCH_TOLERANCE = 0.01
/** Event-indexing lag we tolerate before distrusting a size/type match. */
const INDEX_LAG_GRACE_MS = 120_000

function sizesMatch(a: number, b: number): boolean {
  if (a === b) return true
  const scale = Math.max(Math.abs(a), Math.abs(b))
  if (scale === 0) return false
  return Math.abs(a - b) / scale <= SIZE_MATCH_TOLERANCE
}

/**
 * Decide whether an indexed order is the indexed form of a locally tracked
 * pending submission.
 *
 * The contract/indexer does not echo our client id, so we fall back to an
 * attribute match that must also be recent. Without the recency guard, an old
 * resting order with the same market/type/side/size would wrongly resolve a
 * fresh submission.
 */
export function pendingOrderMatchesIndexed(
  pending: PendingOrderLike,
  indexed: IndexedOrderLike,
): boolean {
  if (indexed.clientOrderId !== undefined) {
    return indexed.clientOrderId === pending.clientOrderId
  }

  if (indexed.marketAddress !== pending.marketAddress) return false
  if (indexed.orderType !== pending.orderType) return false
  if (indexed.isLong !== pending.isLong) return false
  if (!sizesMatch(indexed.sizeUsd, pending.sizeUsd)) return false

  const indexedAt = indexed.createdAt ?? indexed.updatedAt ?? null
  if (indexedAt === null) return true
  return indexedAt >= pending.submittedAt - INDEX_LAG_GRACE_MS
}

/**
 * Drop pending rows that the indexer has since accounted for.
 *
 * Whatever is left is still legitimately "waiting for the indexer", which is
 * what keeps the empty state from appearing over a confirmed order (OB-082).
 */
export function reconcilePendingOrders(
  pending: ReadonlyArray<PendingOrderLike>,
  indexed: ReadonlyArray<IndexedOrderLike>,
): Array<PendingOrderLike> {
  if (pending.length === 0) return []
  return pending.filter(
    (row) => !indexed.some((live) => pendingOrderMatchesIndexed(row, live)),
  )
}
