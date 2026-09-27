// OB-046: display aggregation and cumulative depth for a canonical book.
//
// Grouping is a display concern only. Canonical levels are never mutated and
// executable prices are never derived from bucket prices.
//
// Precision policy: everything is exact integer arithmetic on the atoms from
// OB-044. `quote` is the sum of `price * size` of the canonical levels in a
// bucket, so it carries `priceScale + sizeScale` decimal places and grouping
// conserves both total base quantity and total quote value with no rounding.
// Bucket prices are rounded away from the mid (bids down, asks up), so a
// displayed price is never better than any level it contains.

import type { BookLevel } from "./book-reducer"

export type Side = "bid" | "ask"

export type DepthRow = {
  /** Display price of the bucket (the tick boundary), not an executable price. */
  price: bigint
  /** Total base quantity in the bucket. */
  size: bigint
  /** Sum of `price * size` over the canonical levels in the bucket. */
  quote: bigint
  /** Running base total from the best price through this row. */
  cumulativeSize: bigint
  /** Running quote total from the best price through this row. */
  cumulativeQuote: bigint
}

export type DepthSide = {
  rows: Array<DepthRow>
  totalSize: bigint
  totalQuote: bigint
}

export type DepthScale = {
  /** Largest cumulative base amount across the visible rows, per side. */
  bidMaxCumulativeSize: bigint
  askMaxCumulativeSize: bigint
  /** Shared maximum, for drawing both sides on one axis. */
  maxCumulativeSize: bigint
}

export type BookDepth = {
  bids: DepthSide
  asks: DepthSide
  bestBid: bigint | null
  bestAsk: bigint | null
  /** `bestAsk - bestBid`; null when either side is empty or the book is crossed. */
  spread: bigint | null
  /** True when the best bid is at or above the best ask. */
  crossed: boolean
  scale: DepthScale
}

export type DepthOptions = {
  /** Bucket width in price atoms; must be a positive integer. */
  tick: bigint
  /** Maximum rows per side; omit for all rows. */
  maxRows?: number
}

function bucketPrice(price: bigint, tick: bigint, side: Side): bigint {
  const remainder = price % tick
  if (remainder === 0n) return price
  const floor = price - remainder
  return side === "bid" ? floor : floor + tick
}

/** Group best-first levels into buckets, preserving best-first order. */
export function groupLevels(
  levels: ReadonlyArray<BookLevel>,
  side: Side,
  options: DepthOptions
): DepthSide {
  const { tick, maxRows } = options
  if (tick <= 0n) throw new RangeError("tick must be a positive integer")

  const ordered = [...levels]
    .filter((level) => level.size > 0n)
    .sort((a, b) => {
      const cmp = a.price < b.price ? -1 : a.price > b.price ? 1 : 0
      return side === "bid" ? -cmp : cmp
    })

  const buckets = new Map<bigint, { size: bigint; quote: bigint }>()
  for (const level of ordered) {
    const key = bucketPrice(level.price, tick, side)
    const bucket = buckets.get(key) ?? { size: 0n, quote: 0n }
    bucket.size += level.size
    bucket.quote += level.price * level.size
    buckets.set(key, bucket)
  }

  // Map preserves first-insertion order, which is already best-first.
  let cumulativeSize = 0n
  let cumulativeQuote = 0n
  const rows: Array<DepthRow> = []
  for (const [price, bucket] of buckets) {
    cumulativeSize += bucket.size
    cumulativeQuote += bucket.quote
    rows.push({
      price,
      size: bucket.size,
      quote: bucket.quote,
      cumulativeSize,
      cumulativeQuote,
    })
  }

  const visible = maxRows === undefined ? rows : rows.slice(0, maxRows)
  const last = visible.at(-1)
  return {
    rows: visible,
    totalSize: last?.cumulativeSize ?? 0n,
    totalQuote: last?.cumulativeQuote ?? 0n,
  }
}

/** Derive display buckets, cumulative depth, spread and scales. */
export function buildDepth(
  bids: ReadonlyArray<BookLevel>,
  asks: ReadonlyArray<BookLevel>,
  options: DepthOptions
): BookDepth {
  const bidSide = groupLevels(bids, "bid", options)
  const askSide = groupLevels(asks, "ask", options)

  // Spread comes from canonical levels, never from display buckets.
  const live = (levels: ReadonlyArray<BookLevel>) =>
    levels.filter((level) => level.size > 0n).map((level) => level.price)
  const bidPrices = live(bids)
  const askPrices = live(asks)
  const bestBid = bidPrices.length
    ? bidPrices.reduce((a, b) => (b > a ? b : a))
    : null
  const bestAsk = askPrices.length
    ? askPrices.reduce((a, b) => (b < a ? b : a))
    : null

  const crossed = bestBid !== null && bestAsk !== null && bestBid >= bestAsk
  const spread =
    bestBid !== null && bestAsk !== null && !crossed ? bestAsk - bestBid : null

  const bidMax = bidSide.totalSize
  const askMax = askSide.totalSize
  return {
    bids: bidSide,
    asks: askSide,
    bestBid,
    bestAsk,
    spread,
    crossed,
    scale: {
      bidMaxCumulativeSize: bidMax,
      askMaxCumulativeSize: askMax,
      maxCumulativeSize: bidMax > askMax ? bidMax : askMax,
    },
  }
}
