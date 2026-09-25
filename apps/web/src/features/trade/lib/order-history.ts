/**
 * apps/web/src/features/trade/lib/order-history.ts
 *
 * Order lifecycle history vs. executed fill history (OB-087).
 *
 * An order is a lifecycle record — it can produce zero, one, or many executed
 * fills. Conflating the two is what produced duplicated totals and rows that
 * implied an unfilled remainder had executed, so the two are modelled
 * separately here:
 *
 *   - `FillRecord`  — one immutable executed position change (a fill).
 *   - `OrderHistoryRow` — one order, with its fills *aggregated*.
 *
 * Invariants enforced by `buildOrderHistoryRow`:
 *   - `filledSizeUsd + remainingSizeUsd === originalSizeUsd`
 *   - `filledSizeUsd <= originalSizeUsd` (dust from rounding is clamped)
 *   - a fill is counted exactly once (fills are de-duplicated by `id`)
 *
 * Unit notes: the indexer stores USD and price values as raw 1e30 strings
 * (see apps/s03-indexer/schema.graphql), so both are decoded with
 * `fromSorobanAmount(raw, 30)`.
 */

import { deriveOrderLifecycleStage } from "./order-lifecycle"
import type { PositionChange } from "@/lib/graphql/types"
import type { OrderLifecycleStage } from "./order-lifecycle"
import { fromSorobanAmount } from "@/shared/lib/bignum"

/** USD values in the indexer are 1e30 fixed point. */
export const USD_DECIMALS = 30
/** Prices (`execution_price`, `index_token_price`) use the same 1e30 scale. */
export const PRICE_DECIMALS = 30

/** Slack that absorbs fixed-point rounding when clamping to the original size. */
const SIZE_EPSILON = 1e-9

// ─────────────────────────────────────────────────────────────────────────────
// Fills
// ─────────────────────────────────────────────────────────────────────────────

export type FillChangeType = "increase" | "decrease" | "unknown"

export type FillRecord = {
  /**
   * Unique fill identity.
   *
   * `PositionChange.key` is the *position* key and repeats across fills, so it
   * cannot be used for identity or de-duplication — the entity `id` (which
   * includes ledger and change type) is the stable one.
   */
  id: string
  /** Order this fill executed against, when the indexer could link it. */
  orderKey: string | null
  marketKey: string
  marketName: string
  isLong: boolean
  changeType: FillChangeType
  /** Absolute executed size in USD. */
  sizeUsd: number
  executionPriceUsd: number
  positionFeeUsd: number
  pnlUsd: number
  /** ms since epoch. */
  timestamp: number
}

function parseScaled(raw: string | null | undefined, decimals: number): number {
  if (raw === null || raw === undefined || raw === "") return 0
  const value = raw.trim()
  if (!/^-?\d+$/.test(value)) {
    // Non-integer payloads are already human-readable decimals; keep them.
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  try {
    return fromSorobanAmount(BigInt(value), decimals)
  } catch {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
}

export function parseUsdValue(raw: string | null | undefined): number {
  return parseScaled(raw, USD_DECIMALS)
}

export function parsePriceValue(raw: string | null | undefined): number {
  return parseScaled(raw, PRICE_DECIMALS)
}

function toChangeType(raw: string | null | undefined): FillChangeType {
  const value = (raw ?? "").trim().toLowerCase()
  if (value === "increase") return "increase"
  if (value === "decrease") return "decrease"
  return "unknown"
}

/** True when a position change represents an executed fill. */
export function isExecutedChange(change: PositionChange): boolean {
  return change.status.trim().toLowerCase() === "executed"
}

/** Normalize an indexer timestamp (Date, ISO string, or ms) to ms. */
export function toTimestampMillis(
  value: Date | string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function toFillRecord(change: PositionChange): FillRecord {
  return {
    id: change.id,
    orderKey: change.order?.key ?? null,
    marketKey: change.market.key,
    marketName: change.market.name ?? change.market.key,
    isLong: change.isLong ?? false,
    changeType: toChangeType(change.changeType),
    sizeUsd: Math.abs(parseUsdValue(change.sizeDeltaUsd)),
    executionPriceUsd: parsePriceValue(change.executionPrice),
    positionFeeUsd: Math.abs(parseUsdValue(change.positionFeeAmount)),
    pnlUsd: parseUsdValue(change.pnlUsd),
    timestamp: toTimestampMillis(change.timestamp) ?? 0,
  }
}

export function toFillRecords(
  changes: ReadonlyArray<PositionChange>,
): Array<FillRecord> {
  return changes.filter(isExecutedChange).map(toFillRecord)
}


// ─────────────────────────────────────────────────────────────────────────────
// Per-order fill aggregation
// ─────────────────────────────────────────────────────────────────────────────

export type OrderFillSummary = {
  fillCount: number
  /** Sum of executed fill sizes (USD). */
  filledSizeUsd: number
  /** Size-weighted average execution price (USD), 0 when unknown. */
  averageExecutionPrice: number
  feesUsd: number
  lastFillAt: number | null
}

export const EMPTY_FILL_SUMMARY: OrderFillSummary = {
  fillCount: 0,
  filledSizeUsd: 0,
  averageExecutionPrice: 0,
  feesUsd: 0,
  lastFillAt: null,
}

/**
 * Aggregate fills per order key.
 *
 * Fills are de-duplicated first so an overlapping page cannot inflate an
 * order's executed size (OB-087).
 */
export function summariseFills(
  fills: ReadonlyArray<FillRecord>,
): Map<string, OrderFillSummary> {
  const summaries = new Map<string, OrderFillSummary>()

  for (const fill of dedupeById(fills)) {
    const orderKey = fill.orderKey
    if (orderKey === null || orderKey === "") continue

    const current = summaries.get(orderKey) ?? { ...EMPTY_FILL_SUMMARY }
    const notional = fill.sizeUsd * fill.executionPriceUsd
    const previousNotional =
      current.averageExecutionPrice * current.filledSizeUsd

    const filledSizeUsd = current.filledSizeUsd + fill.sizeUsd
    summaries.set(orderKey, {
      fillCount: current.fillCount + 1,
      filledSizeUsd,
      averageExecutionPrice:
        filledSizeUsd > 0 ? (previousNotional + notional) / filledSizeUsd : 0,
      feesUsd: current.feesUsd + fill.positionFeeUsd,
      lastFillAt:
        current.lastFillAt === null
          ? fill.timestamp
          : Math.max(current.lastFillAt, fill.timestamp),
    })
  }

  return summaries
}

// ─────────────────────────────────────────────────────────────────────────────
// Order lifecycle history rows
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum shape needed to build a history row. */
export type OrderHistorySource = {
  key: string
  clientOrderId?: string
  marketKey: string
  marketName: string
  orderType: string
  isLong: boolean
  status: string
  /** Original submitted size in USD. */
  sizeUsd: number
  awaitingIndex?: boolean
  pendingCancellation?: boolean
  createdAt?: number | null
  updatedAt?: number | null
  transactionHash?: string | null
}

export type OrderHistoryRow = {
  /** Stable row identity: `clientOrderId` survives the indexer key arriving. */
  rowKey: string
  orderKey: string
  clientOrderId?: string
  marketKey: string
  marketName: string
  orderType: string
  isLong: boolean
  stage: OrderLifecycleStage
  originalSizeUsd: number
  filledSizeUsd: number
  remainingSizeUsd: number
  /** 0–100, rounded for display. */
  fillPercent: number
  fillCount: number
  averageExecutionPrice: number
  feesUsd: number
  createdAt: number | null
  updatedAt: number | null
  transactionHash: string | null
}

/**
 * Turn one lifecycle record into a display row.
 *
 * The fill total is always clamped to the original size, so floating-point
 * dust or a mis-linked fill can never make the row claim more execution than
 * the order ever had. `remainingSizeUsd` is what was *not* executed and is the
 * only quantity the UI may present as outstanding.
 */
export function buildOrderHistoryRow(
  order: OrderHistorySource,
  summary: OrderFillSummary = EMPTY_FILL_SUMMARY,
): OrderHistoryRow {
  const originalSizeUsd = Math.max(0, order.sizeUsd)
  const rawFilled = Math.max(0, summary.filledSizeUsd)
  const filledSizeUsd = originalSizeUsd > 0
    ? Math.min(originalSizeUsd, rawFilled)
    : rawFilled
  const remainingSizeUsd = Math.max(0, originalSizeUsd - filledSizeUsd)

  const stage = deriveOrderLifecycleStage({
    status: order.status,
    awaitingIndex: order.awaitingIndex,
    pendingCancellation: order.pendingCancellation,
    originalSizeUsd,
    filledSizeUsd,
  })

  const fillPercent =
    originalSizeUsd > 0
      ? Math.min(100, Math.round((filledSizeUsd / originalSizeUsd) * 100))
      : filledSizeUsd > 0
        ? 100
        : 0

  return {
    rowKey: order.clientOrderId ?? order.key,
    orderKey: order.key,
    clientOrderId: order.clientOrderId,
    marketKey: order.marketKey,
    marketName: order.marketName,
    orderType: order.orderType,
    isLong: order.isLong,
    stage,
    originalSizeUsd,
    filledSizeUsd,
    remainingSizeUsd,
    fillPercent,
    fillCount: summary.fillCount,
    averageExecutionPrice: summary.averageExecutionPrice,
    feesUsd: summary.feesUsd,
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    transactionHash: order.transactionHash ?? null,
  }
}

export function buildOrderHistoryRows(
  orders: ReadonlyArray<OrderHistorySource>,
  fills: ReadonlyArray<FillRecord>,
): Array<OrderHistoryRow> {
  const summaries = summariseFills(fills)
  const seen = new Set<string>()
  const rows: Array<OrderHistoryRow> = []

  for (const order of orders) {
    const rowKey = order.clientOrderId ?? order.key
    if (seen.has(rowKey)) continue
    seen.add(rowKey)
    rows.push(buildOrderHistoryRow(order, summaries.get(order.key)))
  }

  return rows
}

export function isSizeSettled(row: OrderHistoryRow): boolean {
  if (row.stage === "cancelled") return true
  return row.remainingSizeUsd <= SIZE_EPSILON
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters (reflected in query identity, not just in render)
// ─────────────────────────────────────────────────────────────────────────────

export type HistoryTimeRange = "24h" | "7d" | "30d" | "all"

export const HISTORY_TIME_RANGE_LABEL: Record<HistoryTimeRange, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  all: "All time",
}

const HOUR_MS = 3_600_000

export const HISTORY_TIME_RANGE_MS: Record<HistoryTimeRange, number | null> = {
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS,
  all: null,
}

export type OrderHistoryFilters = {
  /** Market contract address; `null` means every market. */
  marketKey: string | null
  /** Lifecycle stage; `"all"` means every stage. */
  stage: OrderLifecycleStage | "all"
  range: HistoryTimeRange
}

export type FillFilters = {
  marketKey: string | null
  side: "all" | "long" | "short"
  range: HistoryTimeRange
}

export const DEFAULT_ORDER_HISTORY_FILTERS: OrderHistoryFilters = {
  marketKey: null,
  stage: "all",
  range: "all",
}

export const DEFAULT_FILL_FILTERS: FillFilters = {
  marketKey: null,
  side: "all",
  range: "all",
}

export function historyRangeSince(
  range: HistoryTimeRange,
  now = Date.now(),
): number | null {
  const span = HISTORY_TIME_RANGE_MS[range]
  return span === null ? null : now - span
}

function pickRange(value: unknown): HistoryTimeRange {
  return value === "24h" || value === "7d" || value === "30d" ? value : "all"
}

const ORDER_LIFECYCLE_STAGES: ReadonlyArray<OrderLifecycleStage> = [
  "pending",
  "accepted",
  "partially-filled",
  "frozen",
  "pending-cancellation",
  "filled",
  "cancelled",
]

function pickStage(value: unknown): OrderLifecycleStage | "all" {
  if (value === "all" || value === undefined || value === null) return "all"
  return ORDER_LIFECYCLE_STAGES.includes(value as OrderLifecycleStage)
    ? (value as OrderLifecycleStage)
    : "all"
}

/**
 * Canonicalise filters before they are used in a query key.
 *
 * Without this, `{ marketKey: undefined }` and `{ marketKey: null }` would be
 * two different cache identities for the same view (OB-087).
 */
export function normaliseOrderHistoryFilters(
  filters?: Partial<OrderHistoryFilters> | null,
): OrderHistoryFilters {
  const marketKey = filters?.marketKey
  return {
    marketKey:
      typeof marketKey === "string" && marketKey !== "" ? marketKey : null,
    stage: pickStage(filters?.stage),
    range: pickRange(filters?.range),
  }
}

export function normaliseFillFilters(
  filters?: Partial<FillFilters> | null,
): FillFilters {
  const marketKey = filters?.marketKey
  const side = filters?.side
  return {
    marketKey:
      typeof marketKey === "string" && marketKey !== "" ? marketKey : null,
    side: side === "long" || side === "short" ? side : "all",
    range: pickRange(filters?.range),
  }
}

export function orderHistoryFiltersAreDefault(
  filters: OrderHistoryFilters,
): boolean {
  const normal = normaliseOrderHistoryFilters(filters)
  return (
    normal.marketKey === DEFAULT_ORDER_HISTORY_FILTERS.marketKey &&
    normal.stage === DEFAULT_ORDER_HISTORY_FILTERS.stage &&
    normal.range === DEFAULT_ORDER_HISTORY_FILTERS.range
  )
}

export function fillFiltersAreDefault(filters: FillFilters): boolean {
  const normal = normaliseFillFilters(filters)
  return (
    normal.marketKey === DEFAULT_FILL_FILTERS.marketKey &&
    normal.side === DEFAULT_FILL_FILTERS.side &&
    normal.range === DEFAULT_FILL_FILTERS.range
  )
}

export function filterOrderHistoryRows(
  rows: ReadonlyArray<OrderHistoryRow>,
  filters: OrderHistoryFilters,
  now = Date.now(),
): Array<OrderHistoryRow> {
  const normal = normaliseOrderHistoryFilters(filters)
  const since = historyRangeSince(normal.range, now)

  return rows.filter((row) => {
    if (normal.marketKey !== null && row.marketKey !== normal.marketKey) {
      return false
    }
    if (normal.stage !== "all" && row.stage !== normal.stage) return false
    if (since !== null) {
      const stamp = row.updatedAt ?? row.createdAt
      if (stamp === null || stamp < since) return false
    }
    return true
  })
}

export function filterFills(
  fills: ReadonlyArray<FillRecord>,
  filters: FillFilters,
  now = Date.now(),
): Array<FillRecord> {
  const normal = normaliseFillFilters(filters)
  const since = historyRangeSince(normal.range, now)

  return fills.filter((fill) => {
    if (normal.marketKey !== null && fill.marketKey !== normal.marketKey) {
      return false
    }
    if (normal.side === "long" && !fill.isLong) return false
    if (normal.side === "short" && fill.isLong) return false
    if (since !== null && fill.timestamp < since) return false
    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Flatten `useInfiniteQuery` pages without dropping earlier loaded pages. */
export function flattenPages<T>(
  pages: ReadonlyArray<ReadonlyArray<T>>,
): Array<T> {
  const flat: Array<T> = []
  for (const page of pages) {
    for (const item of page) flat.push(item)
  }
  return flat
}

/**
 * Stable, order-preserving de-duplication across page boundaries.
 *
 * Offset pagination over live data can return the same row twice; totals and
 * counts must still be computed once per row (OB-087).
 */
export function dedupeById<T extends { id: string }>(
  rows: ReadonlyArray<T>,
): Array<T> {
  const seen = new Set<string>()
  const unique: Array<T> = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

export function dedupeOrderHistoryRows(
  rows: ReadonlyArray<OrderHistoryRow>,
): Array<OrderHistoryRow> {
  const seen = new Set<string>()
  const unique: Array<OrderHistoryRow> = []
  for (const row of rows) {
    if (seen.has(row.rowKey)) continue
    seen.add(row.rowKey)
    unique.push(row)
  }
  return unique
}

/**
 * `hasNextPage` for an offset-paginated indexer query: a full page means there
 * may be more, a short page means the end was reached.
 */
export function hasMorePages(
  lastPageLength: number,
  pageSize: number,
): boolean {
  if (pageSize <= 0) return false
  return lastPageLength >= pageSize
}

/** Next offset for `useInfiniteQuery`. */
export function nextOffset(
  pages: ReadonlyArray<ReadonlyArray<unknown>>,
  pageSize: number,
): number {
  return pages.length * pageSize
}


