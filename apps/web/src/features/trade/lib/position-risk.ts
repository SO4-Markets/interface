/**
 * apps/web/src/features/trade/lib/position-risk.ts
 *
 * Live risk presentation for position rows (OB-085).
 *
 * Two things are deliberately separated:
 *
 *  1. Slowly changing position state — size, entry, collateral, funding, and
 *     the contract's liquidation price. It changes on ledger time.
 *  2. High-frequency price-derived values — mark price, PnL, and the distance
 *     to liquidation. They change on every oracle tick.
 *
 * Only this module derives (2) from (1), so the row can render the derived
 * numbers in leaf components that re-render on a price tick while the rest of
 * the workspace stays put. Every derived number is labelled as an estimate and
 * keeps its source visible, including when the oracle is stale or the risk
 * inputs are missing entirely.
 */

import type { OracleStaleness } from "./pyth"

/** Where a displayed number came from, shown next to it in the row. */
export type RiskDataSource = "contract" | "oracle-estimate" | "unavailable"

export const RISK_SOURCE_LABEL: Record<RiskDataSource, string> = {
  contract: "Contract",
  "oracle-estimate": "Est. oracle",
  unavailable: "No data",
}

/** Short suffix appended to derived numbers so they are never read as exact. */
export const ESTIMATE_SUFFIX = "Est."

export type PositionRiskReading = {
  source: RiskDataSource
  /** True whenever the value is derived rather than read from the contract. */
  isEstimate: boolean
  /** False when the row must show an explicit "risk data unavailable" state. */
  hasData: boolean
  /** True when the oracle price feeding the estimate is stale. */
  isStale: boolean
  /** % of mark price remaining between the current price and liquidation. */
  liquidationDistancePct: number
  /**
   * Estimated USD the position can still absorb before liquidation, i.e. the
   * adverse price move applied to the position size.
   */
  availableRiskUsd: number
}

export const EMPTY_RISK_READING: PositionRiskReading = {
  source: "unavailable",
  isEstimate: false,
  hasData: false,
  isStale: false,
  liquidationDistancePct: 0,
  availableRiskUsd: 0,
}

export type PositionRiskInput = {
  sizeUsd: number
  markPriceUsd: number
  liquidationPriceUsd: number
  isLong: boolean
  markPriceStaleness: OracleStaleness
}

/**
 * Derive the row's risk reading.
 *
 * `availableRiskUsd` is an *estimate*: the contract's liquidation price is
 * authoritative, but the mark price used to measure the remaining distance is
 * the oracle mid price. When either input is missing, `hasData` is false and
 * the row must say so rather than render a fabricated `$0`.
 */
export function describePositionRisk(
  input: PositionRiskInput,
): PositionRiskReading {
  const { sizeUsd, markPriceUsd, liquidationPriceUsd, isLong } = input
  const isStale = input.markPriceStaleness === "stale"

  if (
    !Number.isFinite(sizeUsd) ||
    !Number.isFinite(markPriceUsd) ||
    !Number.isFinite(liquidationPriceUsd) ||
    sizeUsd <= 0 ||
    markPriceUsd <= 0 ||
    liquidationPriceUsd <= 0
  ) {
    return { ...EMPTY_RISK_READING, isStale }
  }

  const rawDistancePct = isLong
    ? ((markPriceUsd - liquidationPriceUsd) / markPriceUsd) * 100
    : ((liquidationPriceUsd - markPriceUsd) / markPriceUsd) * 100

  // A long already trading below its liquidation price is past due; clamp
  // rather than surfacing a negative "available risk".
  const liquidationDistancePct = Math.max(0, rawDistancePct)
  const availableRiskUsd = (liquidationDistancePct / 100) * sizeUsd

  return {
    source: "oracle-estimate",
    isEstimate: true,
    hasData: true,
    isStale,
    liquidationDistancePct,
    availableRiskUsd,
  }
}

/** Tone for the risk cell: highlights positions close to liquidation. */
export function riskSeverity(
  reading: PositionRiskReading,
): "danger" | "warning" | "neutral" {
  if (!reading.hasData) return "neutral"
  if (reading.liquidationDistancePct <= 5) return "danger"
  if (reading.liquidationDistancePct <= 15) return "warning"
  return "neutral"
}

export type LiquidationRiskLevel = "safe" | "warning" | "danger" | "unavailable"

export type MeterThreshold = "neutral" | "success" | "warning" | "danger"

export type PositionRiskMeterModel = {
  level: LiquidationRiskLevel
  threshold: MeterThreshold
  /** 0 (far from liquidation) to 100 (at or past liquidation). */
  riskScore: number
  statusLabel: string
  distanceText: string
  description: string
}

/** Distance at or above which the risk meter reads 0% liquidation risk (2x leverage buffer). */
export const LIQUIDATION_SAFE_DISTANCE_PCT = 50

export function formatLiquidationDistance(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "0.0%"
  return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`
}

/**
 * Derive accessible meter value, semantic threshold, and text equivalents
 * from a {@link PositionRiskReading}.
 */
export function describePositionRiskMeter(
  reading: PositionRiskReading,
): PositionRiskMeterModel {
  if (!reading.hasData) {
    return {
      level: "unavailable",
      threshold: "neutral",
      riskScore: 0,
      statusLabel: "Unavailable",
      distanceText: "—",
      description: reading.isStale
        ? "Liquidation risk unavailable — oracle price is stale"
        : "Liquidation risk unavailable — missing mark or liquidation price",
    }
  }

  const severity = riskSeverity(reading)
  const level: LiquidationRiskLevel =
    severity === "danger" ? "danger" : severity === "warning" ? "warning" : "safe"
  const threshold: MeterThreshold =
    level === "danger" ? "danger" : level === "warning" ? "warning" : "success"
  const statusLabel =
    level === "danger" ? "Critical" : level === "warning" ? "Warning" : "Safe"

  const clampedDistance = Math.max(0, reading.liquidationDistancePct)
  const rawScore =
    ((LIQUIDATION_SAFE_DISTANCE_PCT - clampedDistance) /
      LIQUIDATION_SAFE_DISTANCE_PCT) *
    100
  const riskScore = Math.round(Math.max(0, Math.min(100, rawScore)))
  const distanceText = formatLiquidationDistance(clampedDistance)
  const staleSuffix = reading.isStale ? " (stale oracle)" : ""

  return {
    level,
    threshold,
    riskScore,
    statusLabel,
    distanceText,
    description: `${statusLabel} — ${distanceText} from liquidation${staleSuffix}`,
  }
}

/**
 * Select the position closest to liquidation (highest risk) among `positions`.
 * Returns null when `positions` is empty.
 */
export function pickHighestRiskPosition<
  T extends {
    key: string
    sizeUsd: number
    markPrice: number
    liquidationPrice: number
    isLong: boolean
    indexToken: string
  },
>(
  positions: ReadonlyArray<T>,
  getStaleness: (symbol: string) => OracleStaleness,
): { position: T; reading: PositionRiskReading } | null {
  if (positions.length === 0) return null

  let best: { position: T; reading: PositionRiskReading } | null = null

  for (const position of positions) {
    const reading = describePositionRisk({
      sizeUsd: position.sizeUsd,
      markPriceUsd: position.markPrice,
      liquidationPriceUsd: position.liquidationPrice,
      isLong: position.isLong,
      markPriceStaleness: getStaleness(position.indexToken),
    })

    if (!best) {
      best = { position, reading }
      continue
    }

    if (!best.reading.hasData && reading.hasData) {
      best = { position, reading }
      continue
    }

    if (
      best.reading.hasData &&
      reading.hasData &&
      reading.liquidationDistancePct < best.reading.liquidationDistancePct
    ) {
      best = { position, reading }
    }
  }

  return best
}

/** Percentage of the position size that the posted collateral covers. */
export function collateralCoveragePct(
  sizeUsd: number,
  collateralUsd: number,
): number {
  if (sizeUsd <= 0 || collateralUsd <= 0) return 0
  return Math.min(100, (collateralUsd / sizeUsd) * 100)
}

/**
 * Derive a mark price from authoritative contract numbers.
 *
 * Used when a constraint check needs a price and no oracle price is at hand:
 * the contract's own `pnl / size` gives the fractional move from entry, with no
 * price feed involved. Returns 0 when the inputs cannot produce a sane price.
 */
export function deriveMarkPriceUsd(input: {
  entryPrice: number
  sizeUsd: number
  pnlUsd: number
  isLong: boolean
}): number {
  const { entryPrice, sizeUsd, pnlUsd, isLong } = input
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return 0
  if (!Number.isFinite(pnlUsd)) return 0

  const moveRatio = pnlUsd / sizeUsd
  const markPrice = isLong
    ? entryPrice * (1 + moveRatio)
    : entryPrice * (1 - moveRatio)

  return markPrice > 0 ? markPrice : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable ordering
// ─────────────────────────────────────────────────────────────────────────────

export type PositionOrderIdentity = {
  key: string
  marketName: string
  isLong: boolean
}

/**
 * Deterministic row order derived from identity only.
 *
 * Rows must never be ordered by a price-derived value: a price burst would
 * then reorder the table and move the close/collateral actions out from under
 * the pointer (OB-085).
 */
export function comparePositionRows(
  a: PositionOrderIdentity,
  b: PositionOrderIdentity,
): number {
  const byMarket = a.marketName.localeCompare(b.marketName)
  if (byMarket !== 0) return byMarket
  if (a.isLong !== b.isLong) return a.isLong ? -1 : 1
  return a.key.localeCompare(b.key)
}

export function sortPositionRows<T extends PositionOrderIdentity>(
  rows: ReadonlyArray<T>,
): Array<T> {
  return [...rows].sort(comparePositionRows)
}

/**
 * Re-order `incoming` so rows that were already on screen keep their position.
 * New rows append. Keeps focus and pointer targets stable across refreshes.
 */
export function mergePositionRows<T extends PositionOrderIdentity>(
  previous: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
): Array<T> {
  const sorted = sortPositionRows(incoming)
  if (previous.length === 0) return sorted

  const previousPositions = new Map<string, number>()
  previous.forEach((row, index) => {
    previousPositions.set(row.key, index)
  })

  return sorted.sort((a, b) => {
    const aIndex = previousPositions.get(a.key)
    const bIndex = previousPositions.get(b.key)
    if (aIndex === undefined && bIndex === undefined) return 0
    if (aIndex === undefined) return 1
    if (bIndex === undefined) return -1
    return aIndex - bIndex
  })
}
