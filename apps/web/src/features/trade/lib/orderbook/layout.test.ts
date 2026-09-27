import { describe, expect, it } from "vitest"
import { buildDepth } from "./depth"
import {
  BOOK_LAYOUTS,
  DEFAULT_BOOK_LAYOUT,
  allocateRows,
  depthFraction,
  isBookLayout,
  selectVisibleDepth,
  toBookLayout,
} from "./layout"
import type { BookLevel } from "./book-reducer"

const L = (price: bigint, size: bigint): BookLevel => ({ price, size })

const depth = buildDepth(
  [L(100n, 4n), L(99n, 3n), L(98n, 2n), L(97n, 1n)],
  [L(101n, 1n), L(102n, 2n), L(103n, 3n), L(104n, 4n)],
  { tick: 1n }
)

describe("layout guards", () => {
  it("accepts only the three layouts", () => {
    for (const layout of BOOK_LAYOUTS) expect(isBookLayout(layout)).toBe(true)
    for (const bad of ["both ", "BOTH", "", null, undefined, 1, {}]) expect(isBookLayout(bad)).toBe(false)
  })

  it("falls back to the default for anything else", () => {
    expect(toBookLayout("asks")).toBe("asks")
    expect(toBookLayout("sideways")).toBe(DEFAULT_BOOK_LAYOUT)
    expect(toBookLayout(undefined)).toBe(DEFAULT_BOOK_LAYOUT)
  })
})

describe("allocateRows", () => {
  it("gives a single-side layout every row", () => {
    expect(allocateRows("bids", 12)).toEqual({ bidRows: 12, askRows: 0 })
    expect(allocateRows("asks", 12)).toEqual({ bidRows: 0, askRows: 12 })
  })

  it("splits both sides evenly, with an odd row going to asks", () => {
    expect(allocateRows("both", 10)).toEqual({ bidRows: 5, askRows: 5 })
    expect(allocateRows("both", 11)).toEqual({ bidRows: 5, askRows: 6 })
    expect(allocateRows("both", 9)).toEqual({ bidRows: 4, askRows: 5 })
  })

  it("never lets a side disappear in the both layout", () => {
    expect(allocateRows("both", 0)).toEqual({ bidRows: 1, askRows: 1 })
    expect(allocateRows("both", 1)).toEqual({ bidRows: 1, askRows: 1 })
    expect(allocateRows("both", 2)).toEqual({ bidRows: 1, askRows: 1 })
  })

  it("is deterministic and consumes exactly the rows available", () => {
    for (let rows = 2; rows <= 40; rows++) {
      const a = allocateRows("both", rows)
      expect(allocateRows("both", rows)).toEqual(a)
      expect(a.bidRows + a.askRows).toBe(rows)
      expect(a.askRows - a.bidRows).toBeLessThanOrEqual(1)
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -5, 3.9])("sanitizes %s", (rows) => {
    const a = allocateRows("bids", rows)
    expect(Number.isInteger(a.bidRows)).toBe(true)
    expect(a.bidRows).toBeGreaterThanOrEqual(0)
  })
})

describe("selectVisibleDepth", () => {
  it("both: best bid first, asks worst-first so the best ask sits by the spread", () => {
    const v = selectVisibleDepth(depth, "both", 6)
    expect(v.asks.map((r) => r.price)).toEqual([103n, 102n, 101n])
    expect(v.bids.map((r) => r.price)).toEqual([100n, 99n, 98n])
  })

  it("bids only: no ask rows, bids sorted best-first", () => {
    const v = selectVisibleDepth(depth, "bids", 3)
    expect(v.asks).toEqual([])
    expect(v.bids.map((r) => r.price)).toEqual([100n, 99n, 98n])
  })

  it("asks only: no bid rows, still worst-first towards the spread", () => {
    const v = selectVisibleDepth(depth, "asks", 3)
    expect(v.bids).toEqual([])
    expect(v.asks.map((r) => r.price)).toEqual([103n, 102n, 101n])
  })

  it("keeps the best level on each side when rows are trimmed", () => {
    const v = selectVisibleDepth(depth, "both", 2)
    expect(v.asks.map((r) => r.price)).toEqual([101n])
    expect(v.bids.map((r) => r.price)).toEqual([100n])
  })

  it("never shows more rows than the book has", () => {
    const v = selectVisibleDepth(depth, "bids", 100)
    expect(v.bids).toHaveLength(4)
  })

  it("does not mutate the depth", () => {
    const before = depth.asks.rows.map((r) => r.price)
    selectVisibleDepth(depth, "both", 6)
    expect(depth.asks.rows.map((r) => r.price)).toEqual(before)
  })

  it("preserves grouping: rows come from the grouped depth it is given", () => {
    const grouped = buildDepth(
      [L(100n, 4n), L(99n, 3n), L(98n, 2n), L(97n, 1n)],
      [L(101n, 1n), L(102n, 2n), L(103n, 3n), L(104n, 4n)],
      { tick: 2n }
    )
    const v = selectVisibleDepth(grouped, "both", 4)
    expect(v.bids.map((r) => r.price)).toEqual([100n, 98n])
    expect(v.asks.map((r) => r.price)).toEqual([104n, 102n])
  })
})

describe("depthFraction", () => {
  it("scales against the largest cumulative size actually shown", () => {
    const both = selectVisibleDepth(depth, "both", 8)
    const bids = selectVisibleDepth(depth, "bids", 4)
    const deepestBid = bids.bids.at(-1)!
    // Both sides have 10 cumulative here, so the deepest row fills the bar in either layout.
    expect(depthFraction(deepestBid, both)).toBe(1)
    expect(depthFraction(deepestBid, bids)).toBe(1)
  })

  it("a single-side layout is not dwarfed by the hidden side", () => {
    const lopsided = buildDepth([L(100n, 1n)], [L(101n, 100n)], { tick: 1n })
    const bidsOnly = selectVisibleDepth(lopsided, "bids", 3)
    const both = selectVisibleDepth(lopsided, "both", 4)
    expect(depthFraction(bidsOnly.bids[0], bidsOnly)).toBe(1)
    expect(depthFraction(both.bids[0], both)).toBe(0.01)
  })

  it("is 0 for an empty book and never above 1", () => {
    const empty = selectVisibleDepth(buildDepth([], [], { tick: 1n }), "both", 4)
    expect(empty.asks).toEqual([])
    const row = { price: 1n, size: 1n, quote: 1n, cumulativeSize: 5n, cumulativeQuote: 1n }
    expect(depthFraction(row, empty)).toBe(0)
    const one = selectVisibleDepth(depth, "bids", 1)
    expect(depthFraction({ ...row, cumulativeSize: 999n }, one)).toBe(1)
  })
})
