// OB-053: depth layouts (both sides, bids only, asks only).
//
// A layout decides which side's rows are shown and how many; it never changes
// the data. The spread and the market identity stay visible in every layout
// (see the component), and rows are always sorted best-first from the spread.

import type { BookDepth, DepthRow } from "./depth"

export type BookLayout = "both" | "bids" | "asks"

export const BOOK_LAYOUTS: ReadonlyArray<BookLayout> = ["both", "bids", "asks"]

export const DEFAULT_BOOK_LAYOUT: BookLayout = "both"

export function isBookLayout(value: unknown): value is BookLayout {
  return value === "both" || value === "bids" || value === "asks"
}

/** Falls back to the default for anything that is not a known layout. */
export function toBookLayout(value: unknown): BookLayout {
  return isBookLayout(value) ? value : DEFAULT_BOOK_LAYOUT
}

export type RowAllocation = {
  bidRows: number
  askRows: number
}

/**
 * Split `availableRows` (rows for depth, not counting the spread row) between
 * the sides. Deterministic: a single-side layout gets every row; both sides
 * split evenly and an odd row goes to the ask side, so resizing one row at a
 * time alternates predictably instead of jumping. `both` never shows fewer
 * than one row per side, since a side that vanishes would hide the very
 * context that layout exists to show.
 */
export function allocateRows(layout: BookLayout, availableRows: number): RowAllocation {
  const rows = Number.isFinite(availableRows) ? Math.max(0, Math.floor(availableRows)) : 0
  switch (layout) {
    case "bids":
      return { bidRows: rows, askRows: 0 }
    case "asks":
      return { bidRows: 0, askRows: rows }
    case "both": {
      const total = Math.max(rows, 2)
      const askRows = Math.ceil(total / 2)
      return { bidRows: total - askRows, askRows }
    }
  }
}

export type VisibleDepth = {
  layout: BookLayout
  /** Ask rows in display order: worst price first, best ask last, next to the spread. */
  asks: Array<DepthRow>
  /** Bid rows in display order: best bid first, next to the spread. */
  bids: Array<DepthRow>
  allocation: RowAllocation
}

/** The rows to draw for a layout, sorted and trimmed. Input rows are best-first. */
export function selectVisibleDepth(depth: BookDepth, layout: BookLayout, availableRows: number): VisibleDepth {
  const allocation = allocateRows(layout, availableRows)
  return {
    layout,
    asks: depth.asks.rows.slice(0, allocation.askRows).reverse(),
    bids: depth.bids.rows.slice(0, allocation.bidRows),
    allocation,
  }
}

/**
 * Width of a row's depth bar as a fraction in [0, 1]. Scaled against the
 * largest cumulative size that is actually visible in this layout, so a
 * single-side layout uses its full width rather than being dwarfed by a side
 * that is not shown.
 */
export function depthFraction(row: DepthRow, visible: VisibleDepth): number {
  const last = (rows: Array<DepthRow>) => rows.reduce((max, r) => (r.cumulativeSize > max ? r.cumulativeSize : max), 0n)
  const max = last(visible.asks) > last(visible.bids) ? last(visible.asks) : last(visible.bids)
  if (max <= 0n) return 0
  // Basis-point precision in exact integer arithmetic, then to a fraction.
  const bps = (row.cumulativeSize * 10_000n) / max
  return Number(bps > 10_000n ? 10_000n : bps) / 10_000
}
