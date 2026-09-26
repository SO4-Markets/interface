// OB-052: display grouping and size-unit preferences for the order book.
//
// Everything here is display-only. Grouping never changes the canonical book
// (OB-045/OB-046 keep it in integer atoms) and never touches an order ticket
// price: a bucket price is a label, not an executable price.
//
// Preferences are stored as a grouping MULTIPLIER of the market's native tick
// (1x, 2x, 5x ...), not as an absolute price, so the same choice stays
// meaningful when markets with different tick sizes are switched between. A
// stored value is only ever used after `sanitizeDisplayPrefs` has checked it
// against the market's current metadata: if the tick, precision or capabilities
// change and the stored choice is no longer offered, it is reset, and the caller
// is told what was reset.

import type { DepthRow } from "./depth"

export type SizeUnit = "base" | "quote"

export const SIZE_UNITS: ReadonlyArray<SizeUnit> = ["base", "quote"]

/** Runtime check for a value that arrived from storage or an event handler. */
export function isSizeUnit(value: unknown): value is SizeUnit {
  return value === "base" || value === "quote"
}

/** Grouping steps offered, as multiples of the market's native tick. */
export const GROUPING_MULTIPLIERS: ReadonlyArray<number> = [1, 2, 5, 10, 50, 100, 500, 1000]

/**
 * What the display needs to know about a market. Prices and sizes are integer
 * atoms; `priceScale` and `sizeScale` are their decimal places.
 */
export type MarketDisplayMetadata = {
  marketId: string
  baseSymbol: string
  quoteSymbol: string
  /** Decimal places of a price atom. */
  priceScale: number
  /** Decimal places of a size atom. */
  sizeScale: number
  /** Native price increment in price atoms; must be positive. */
  tickSize: bigint
}

export type DisplayPrefs = {
  /** Grouping as a multiple of the native tick; always one of the offered multipliers. */
  groupingMultiplier: number
  unit: SizeUnit
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = { groupingMultiplier: 1, unit: "base" }

const MAX_SCALE = 18

function isScale(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCALE
}

/** Metadata is only usable if every field is present and sane. */
export function isValidMetadata(meta: MarketDisplayMetadata | null | undefined): meta is MarketDisplayMetadata {
  return (
    !!meta &&
    typeof meta.marketId === "string" &&
    meta.marketId.length > 0 &&
    typeof meta.baseSymbol === "string" &&
    meta.baseSymbol.length > 0 &&
    typeof meta.quoteSymbol === "string" &&
    meta.quoteSymbol.length > 0 &&
    isScale(meta.priceScale) &&
    isScale(meta.sizeScale) &&
    typeof meta.tickSize === "bigint" &&
    meta.tickSize > 0n
  )
}

/** Exact decimal string for an atom value, with trailing zeros trimmed to `minDecimals`. */
export function formatScaled(value: bigint, scale: number, minDecimals = 0): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const digits = abs.toString().padStart(scale + 1, "0")
  const whole = scale === 0 ? digits : digits.slice(0, digits.length - scale)
  let fraction = scale === 0 ? "" : digits.slice(digits.length - scale)
  while (fraction.length > minDecimals && fraction.endsWith("0")) fraction = fraction.slice(0, -1)
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`
}

export type GroupingOption = {
  multiplier: number
  /** Bucket width in price atoms. */
  tick: bigint
  /** Human label, e.g. "0.50". */
  label: string
}

/**
 * The groupings this market supports. Empty for unusable metadata, so a caller
 * can disable the control rather than offer a grouping it cannot honour.
 */
export function groupingOptions(meta: MarketDisplayMetadata | null | undefined): Array<GroupingOption> {
  if (!isValidMetadata(meta)) return []
  return GROUPING_MULTIPLIERS.map((multiplier) => {
    const tick = meta.tickSize * BigInt(multiplier)
    return { multiplier, tick, label: formatScaled(tick, meta.priceScale) }
  })
}

/** Bucket width in price atoms for the given preferences. Falls back to the native tick. */
export function tickFor(prefs: DisplayPrefs, meta: MarketDisplayMetadata): bigint {
  return meta.tickSize * BigInt(prefs.groupingMultiplier)
}

export type SanitizedPrefs = {
  prefs: DisplayPrefs
  /** Which stored values were invalid for this market and replaced by defaults. */
  reset: { grouping: boolean; unit: boolean }
}

/**
 * Turn whatever was stored (possibly corrupt, from another version, or from a
 * market whose precision has since changed) into preferences that are valid
 * for `meta`. Never throws.
 */
export function sanitizeDisplayPrefs(raw: unknown, meta: MarketDisplayMetadata | null | undefined): SanitizedPrefs {
  const stored = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null
  const offered = new Set(groupingOptions(meta).map((o) => o.multiplier))

  const wantedGrouping = stored?.groupingMultiplier
  const groupingValid = typeof wantedGrouping === "number" && offered.has(wantedGrouping)
  const wantedUnit = stored?.unit
  const unitValid = isSizeUnit(wantedUnit)

  return {
    prefs: {
      groupingMultiplier: groupingValid ? wantedGrouping : DEFAULT_DISPLAY_PREFS.groupingMultiplier,
      unit: unitValid ? wantedUnit : DEFAULT_DISPLAY_PREFS.unit,
    },
    // Nothing stored is not a reset: only a stored value that had to be replaced is.
    reset: {
      grouping: stored !== null && stored.groupingMultiplier !== undefined && !groupingValid,
      unit: stored !== null && stored.unit !== undefined && !unitValid,
    },
  }
}

export type RowSizeDisplay = {
  size: string
  cumulative: string
  /** Symbol the two figures are denominated in. */
  symbol: string
}

/**
 * A row's size and running total in the chosen unit. Base is the atom size at
 * `sizeScale`; quote is the sum of `price * size`, which carries
 * `priceScale + sizeScale` decimal places (see OB-046), so it is exact.
 */
export function rowSizeDisplay(row: DepthRow, unit: SizeUnit, meta: MarketDisplayMetadata): RowSizeDisplay {
  if (unit === "quote") {
    const scale = meta.priceScale + meta.sizeScale
    return {
      size: formatScaled(row.quote, scale, 2),
      cumulative: formatScaled(row.cumulativeQuote, scale, 2),
      symbol: meta.quoteSymbol,
    }
  }
  return {
    size: formatScaled(row.size, meta.sizeScale),
    cumulative: formatScaled(row.cumulativeSize, meta.sizeScale),
    symbol: meta.baseSymbol,
  }
}

/** A bucket price, shown at the market's price precision. */
export function formatBucketPrice(price: bigint, meta: MarketDisplayMetadata): string {
  return formatScaled(price, meta.priceScale, Math.min(meta.priceScale, 2))
}
