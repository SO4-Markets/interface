import { describe, expect, it } from "vitest"
import { buildDepth, groupLevels } from "./depth"
import type { BookLevel } from "./book-reducer"

const lv = (price: number, size: number): BookLevel => ({
  price: BigInt(price),
  size: BigInt(size),
})

const sum = (levels: ReadonlyArray<BookLevel>, f: (l: BookLevel) => bigint) =>
  levels.reduce((acc, l) => acc + f(l), 0n)

describe("groupLevels", () => {
  it("rounds bids down and asks up to the tick", () => {
    const bids = groupLevels([lv(107, 1), lv(103, 2)], "bid", { tick: 5n })
    expect(bids.rows.map((r) => r.price)).toEqual([105n, 100n])
    const asks = groupLevels([lv(101, 1), lv(106, 2)], "ask", { tick: 5n })
    expect(asks.rows.map((r) => r.price)).toEqual([105n, 110n])
  })

  it("keeps exact tick multiples in place", () => {
    const side = groupLevels([lv(100, 1), lv(95, 1)], "bid", { tick: 5n })
    expect(side.rows.map((r) => r.price)).toEqual([100n, 95n])
  })

  it("conserves total quantity and quote value", () => {
    const levels = [lv(107, 3), lv(106, 2), lv(103, 5), lv(101, 1)]
    const grouped = groupLevels(levels, "bid", { tick: 5n })
    expect(grouped.totalSize).toBe(sum(levels, (l) => l.size))
    expect(grouped.totalQuote).toBe(sum(levels, (l) => l.price * l.size))
  })

  it("keeps rows best-first with rising cumulative totals", () => {
    const bids = groupLevels([lv(99, 1), lv(100, 2), lv(94, 4)], "bid", {
      tick: 5n,
    })
    expect(bids.rows.map((r) => r.price)).toEqual([100n, 95n, 90n])
    expect(bids.rows.map((r) => r.cumulativeSize)).toEqual([2n, 3n, 7n])
    const asks = groupLevels([lv(102, 1), lv(101, 2), lv(111, 4)], "ask", {
      tick: 5n,
    })
    expect(asks.rows.map((r) => r.price)).toEqual([105n, 115n])
    expect(asks.rows.map((r) => r.cumulativeSize)).toEqual([3n, 7n])
  })

  it("accumulates cumulative quote from canonical prices, not bucket prices", () => {
    const grouped = groupLevels([lv(103, 2), lv(101, 1)], "ask", { tick: 5n })
    expect(grouped.rows).toHaveLength(1)
    expect(grouped.rows[0]?.quote).toBe(103n * 2n + 101n * 1n)
    expect(grouped.rows[0]?.cumulativeQuote).toBe(103n * 2n + 101n)
  })

  it("does not mutate the canonical levels or their order", () => {
    const levels = [lv(99, 1), lv(107, 2), lv(103, 3)]
    const snapshot = levels.map((l) => ({ ...l }))
    groupLevels(levels, "bid", { tick: 5n })
    expect(levels).toEqual(snapshot)
  })

  it("supports changing the grouping without losing detail", () => {
    const levels = [lv(107, 1), lv(106, 1), lv(103, 1), lv(101, 1)]
    const fine = groupLevels(levels, "bid", { tick: 1n })
    const coarse = groupLevels(levels, "bid", { tick: 10n })
    expect(fine.rows).toHaveLength(4)
    expect(coarse.rows.map((r) => r.price)).toEqual([100n])
    expect(coarse.totalSize).toBe(fine.totalSize)
    expect(coarse.totalQuote).toBe(fine.totalQuote)
  })

  it("caps the number of rows and totals only what is visible", () => {
    const side = groupLevels([lv(100, 1), lv(99, 2), lv(98, 4)], "bid", {
      tick: 1n,
      maxRows: 2,
    })
    expect(side.rows).toHaveLength(2)
    expect(side.totalSize).toBe(3n)
  })

  it("ignores zero-size levels", () => {
    const side = groupLevels([lv(100, 0), lv(99, 1)], "bid", { tick: 1n })
    expect(side.rows.map((r) => r.price)).toEqual([99n])
  })

  it("returns an empty side for empty depth", () => {
    const side = groupLevels([], "bid", { tick: 1n })
    expect(side).toEqual({ rows: [], totalSize: 0n, totalQuote: 0n })
  })

  it("rejects a non-positive tick", () => {
    expect(() => groupLevels([lv(1, 1)], "bid", { tick: 0n })).toThrow(
      RangeError
    )
    expect(() => groupLevels([lv(1, 1)], "ask", { tick: -1n })).toThrow(
      RangeError
    )
  })
})

describe("buildDepth", () => {
  it("computes spread from canonical best prices, not buckets", () => {
    const depth = buildDepth([lv(101, 1)], [lv(103, 1)], { tick: 10n })
    expect(depth.bestBid).toBe(101n)
    expect(depth.bestAsk).toBe(103n)
    expect(depth.spread).toBe(2n)
    expect(depth.crossed).toBe(false)
  })

  it("handles a one-sided book (bids only)", () => {
    const depth = buildDepth([lv(100, 2)], [], { tick: 1n })
    expect(depth.bestBid).toBe(100n)
    expect(depth.bestAsk).toBeNull()
    expect(depth.spread).toBeNull()
    expect(depth.crossed).toBe(false)
    expect(depth.scale.askMaxCumulativeSize).toBe(0n)
    expect(depth.scale.maxCumulativeSize).toBe(2n)
  })

  it("handles a one-sided book (asks only)", () => {
    const depth = buildDepth([], [lv(100, 2)], { tick: 1n })
    expect(depth.bestBid).toBeNull()
    expect(depth.bestAsk).toBe(100n)
    expect(depth.spread).toBeNull()
  })

  it("handles an empty book", () => {
    const depth = buildDepth([], [], { tick: 1n })
    expect(depth.bids.rows).toEqual([])
    expect(depth.asks.rows).toEqual([])
    expect(depth.spread).toBeNull()
    expect(depth.crossed).toBe(false)
    expect(depth.scale.maxCumulativeSize).toBe(0n)
  })

  it("flags a crossed book and reports no spread", () => {
    const depth = buildDepth([lv(105, 1)], [lv(100, 1)], { tick: 1n })
    expect(depth.crossed).toBe(true)
    expect(depth.spread).toBeNull()
    expect(depth.bestBid).toBe(105n)
    expect(depth.bestAsk).toBe(100n)
  })

  it("flags a locked book (bid equals ask) as crossed", () => {
    const depth = buildDepth([lv(100, 1)], [lv(100, 1)], { tick: 1n })
    expect(depth.crossed).toBe(true)
    expect(depth.spread).toBeNull()
  })

  it("derives shared and per-side depth scales", () => {
    const depth = buildDepth(
      [lv(100, 3), lv(99, 2)],
      [lv(101, 1), lv(102, 1)],
      { tick: 1n }
    )
    expect(depth.scale.bidMaxCumulativeSize).toBe(5n)
    expect(depth.scale.askMaxCumulativeSize).toBe(2n)
    expect(depth.scale.maxCumulativeSize).toBe(5n)
  })

  it("keeps the crossed flag independent of display grouping", () => {
    const levels = { bids: [lv(101, 1)], asks: [lv(102, 1)] }
    for (const tick of [1n, 5n, 100n]) {
      const depth = buildDepth(levels.bids, levels.asks, { tick })
      expect(depth.crossed).toBe(false)
      expect(depth.spread).toBe(1n)
    }
  })
})
