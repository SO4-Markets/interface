import { describe, expect, it } from "vitest"
import {  buildDepth, groupLevels } from "./depth"
import {
  DEFAULT_DISPLAY_PREFS,
  GROUPING_MULTIPLIERS,
  
  formatBucketPrice,
  formatScaled,
  groupingOptions,
  isValidMetadata,
  rowSizeDisplay,
  sanitizeDisplayPrefs,
  tickFor
} from "./display-prefs"
import type {MarketDisplayMetadata} from "./display-prefs";
import type {DepthRow} from "./depth";
import type { BookLevel } from "./book-reducer"

// BTC/USD-like: prices to 2 decimals, sizes to 4, native tick 0.01.
const BTC: MarketDisplayMetadata = {
  marketId: "BTC-USD",
  baseSymbol: "BTC",
  quoteSymbol: "USD",
  priceScale: 2,
  sizeScale: 4,
  tickSize: 1n,
}
// XLM/USD-like: prices to 5 decimals, sizes to 1, native tick 0.00010.
const XLM: MarketDisplayMetadata = {
  marketId: "XLM-USD",
  baseSymbol: "XLM",
  quoteSymbol: "USD",
  priceScale: 5,
  sizeScale: 1,
  tickSize: 10n,
}

const L = (price: bigint, size: bigint): BookLevel => ({ price, size })

describe("formatScaled", () => {
  it.each([
    [0n, 2, "0"],
    [5n, 2, "0.05"],
    [100n, 2, "1"],
    [123456n, 2, "1,234.56"],
    [1_000_000n, 0, "1,000,000"],
    [1n, 5, "0.00001"],
    [-1250n, 2, "-12.5"],
  ])("formats %s at scale %s as %s", (value, scale, expected) => {
    expect(formatScaled(value, scale)).toBe(expected)
  })

  it("keeps a minimum number of decimals", () => {
    expect(formatScaled(1200n, 2, 2)).toBe("12.00")
    expect(formatScaled(1250n, 2, 1)).toBe("12.5")
  })

  it("is exact beyond Number's safe integer range", () => {
    expect(formatScaled(123456789012345678901234567890n, 4)).toBe("12,345,678,901,234,567,890,123,456.789")
  })
})

describe("isValidMetadata", () => {
  it("accepts a well-formed market", () => {
    expect(isValidMetadata(BTC)).toBe(true)
  })

  it.each([
    ["missing", undefined],
    ["null", null],
    ["zero tick", { ...BTC, tickSize: 0n }],
    ["negative tick", { ...BTC, tickSize: -1n }],
    ["fractional scale", { ...BTC, priceScale: 1.5 }],
    ["negative scale", { ...BTC, sizeScale: -1 }],
    ["oversized scale", { ...BTC, priceScale: 19 }],
    ["empty symbol", { ...BTC, baseSymbol: "" }],
    ["empty id", { ...BTC, marketId: "" }],
  ])("rejects %s metadata", (_label, meta) => {
    expect(isValidMetadata(meta)).toBe(false)
  })
})

describe("groupingOptions", () => {
  it("offers multiples of the native tick with exact labels", () => {
    expect(groupingOptions(BTC).map((o) => [o.multiplier, o.tick, o.label])).toEqual([
      [1, 1n, "0.01"],
      [2, 2n, "0.02"],
      [5, 5n, "0.05"],
      [10, 10n, "0.1"],
      [50, 50n, "0.5"],
      [100, 100n, "1"],
      [500, 500n, "5"],
      [1000, 1000n, "10"],
    ])
  })

  it("scales with a different tick size", () => {
    const options = groupingOptions(XLM)
    expect(options[0]).toMatchObject({ multiplier: 1, tick: 10n, label: "0.0001" })
    expect(options.at(-1)).toMatchObject({ multiplier: 1000, tick: 10_000n, label: "0.1" })
  })

  it("offers nothing for unusable metadata so the control can be disabled", () => {
    expect(groupingOptions(null)).toEqual([])
    expect(groupingOptions({ ...BTC, tickSize: 0n })).toEqual([])
  })

  it("every option is an exact multiple of the native tick", () => {
    for (const meta of [BTC, XLM]) {
      for (const option of groupingOptions(meta)) {
        expect(option.tick % meta.tickSize).toBe(0n)
      }
    }
  })
})

describe("sanitizeDisplayPrefs", () => {
  it("keeps valid stored preferences", () => {
    expect(sanitizeDisplayPrefs({ groupingMultiplier: 10, unit: "quote" }, BTC)).toEqual({
      prefs: { groupingMultiplier: 10, unit: "quote" },
      reset: { grouping: false, unit: false },
    })
  })

  it("uses defaults, without reporting a reset, when nothing is stored", () => {
    for (const raw of [undefined, null]) {
      expect(sanitizeDisplayPrefs(raw, BTC)).toEqual({
        prefs: DEFAULT_DISPLAY_PREFS,
        reset: { grouping: false, unit: false },
      })
    }
  })

  it("resets a grouping the market no longer offers, and says so", () => {
    const result = sanitizeDisplayPrefs({ groupingMultiplier: 7, unit: "quote" }, BTC)
    expect(result.prefs).toEqual({ groupingMultiplier: 1, unit: "quote" })
    expect(result.reset).toEqual({ grouping: true, unit: false })
  })

  it("resets an unknown unit", () => {
    const result = sanitizeDisplayPrefs({ groupingMultiplier: 5, unit: "lots" }, BTC)
    expect(result.prefs).toEqual({ groupingMultiplier: 5, unit: "base" })
    expect(result.reset).toEqual({ grouping: false, unit: true })
  })

  it.each([
    ["a string", "garbage"],
    ["a number", 42],
    ["an array", [1, 2]],
    ["wrong field types", { groupingMultiplier: "10", unit: 3 }],
  ])("recovers from %s", (_label, raw) => {
    const result = sanitizeDisplayPrefs(raw, BTC)
    expect(result.prefs).toEqual(DEFAULT_DISPLAY_PREFS)
  })

  it("resets the grouping when the market's capabilities disappear", () => {
    const result = sanitizeDisplayPrefs({ groupingMultiplier: 100, unit: "base" }, { ...BTC, tickSize: 0n })
    expect(result.prefs.groupingMultiplier).toBe(1)
    expect(result.reset.grouping).toBe(true)
  })

  it("a multiplier survives a switch to a market with a different tick", () => {
    const stored = { groupingMultiplier: 10, unit: "quote" }
    expect(sanitizeDisplayPrefs(stored, BTC).prefs).toEqual(stored)
    expect(sanitizeDisplayPrefs(stored, XLM).prefs).toEqual(stored)
    expect(tickFor(stored as never, BTC)).toBe(10n)
    expect(tickFor(stored as never, XLM)).toBe(100n)
  })
})

describe("grouping matches exact aggregation fixtures", () => {
  // Prices in 0.01 atoms. Bids best-first: 100.07, 100.05, 100.04, 99.96 ... Asks: 100.08 ...
  const bids = [L(10_007n, 10_000n), L(10_005n, 20_000n), L(10_004n, 5_000n), L(9_996n, 30_000n), L(9_990n, 1_000n)]
  const asks = [L(10_008n, 10_000n), L(10_010n, 20_000n), L(10_013n, 5_000n), L(10_020n, 30_000n), L(10_031n, 1_000n)]

  it("groups bids down and asks up to 0.05 (5 ticks) with exact totals", () => {
    const bidSide = groupLevels(bids, "bid", { tick: 5n })
    expect(bidSide.rows.map((r) => [r.price, r.size])).toEqual([
      [10_005n, 30_000n], // 100.07 + 100.05 -> 100.05
      [10_000n, 5_000n], // 100.04 -> 100.00
      [9_995n, 30_000n], // 99.96 -> 99.95
      [9_990n, 1_000n],
    ])
    const askSide = groupLevels(asks, "ask", { tick: 5n })
    expect(askSide.rows.map((r) => [r.price, r.size])).toEqual([
      [10_010n, 30_000n], // 100.08 + 100.10 -> 100.10 (8 rounds up)
      [10_015n, 5_000n], // 100.13 -> 100.15
      [10_020n, 30_000n],
      [10_035n, 1_000n], // 100.31 -> 100.35
    ])
  })

  it("never shows a price better than any level it contains", () => {
    for (const option of groupingOptions(BTC)) {
      for (const row of groupLevels(bids, "bid", { tick: option.tick }).rows) {
        const contained = bids.filter((l) => l.price - (l.price % option.tick) === row.price)
        for (const level of contained) expect(row.price).toBeLessThanOrEqual(level.price)
      }
      for (const row of groupLevels(asks, "ask", { tick: option.tick }).rows) {
        const contained = asks.filter((l) => (l.price % option.tick === 0n ? l.price : l.price - (l.price % option.tick) + option.tick) === row.price)
        for (const level of contained) expect(row.price).toBeGreaterThanOrEqual(level.price)
      }
    }
  })

  it("conserves total size and quote value at every grouping", () => {
    const totalSize = bids.reduce((s, l) => s + l.size, 0n)
    const totalQuote = bids.reduce((s, l) => s + l.price * l.size, 0n)
    for (const option of groupingOptions(BTC)) {
      const side = groupLevels(bids, "bid", { tick: option.tick })
      expect(side.totalSize).toBe(totalSize)
      expect(side.totalQuote).toBe(totalQuote)
    }
  })

  it("does not change the canonical book or the spread", () => {
    const frozenBids = Object.freeze(bids.map((l) => Object.freeze({ ...l })))
    const frozenAsks = Object.freeze(asks.map((l) => Object.freeze({ ...l })))
    const before = JSON.stringify(
      [frozenBids, frozenAsks],
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )
    const baseline = buildDepth(frozenBids, frozenAsks, { tick: 1n })

    for (const option of groupingOptions(BTC)) {
      const grouped = buildDepth(frozenBids, frozenAsks, { tick: option.tick })
      // Spread is computed from canonical levels, so no grouping can move it.
      expect(grouped.spread).toBe(baseline.spread)
      expect(grouped.bestBid).toBe(10_007n)
      expect(grouped.bestAsk).toBe(10_008n)
    }
    expect(
      JSON.stringify([frozenBids, frozenAsks], (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    ).toBe(before)
  })
})

describe("rowSizeDisplay", () => {
  const row: DepthRow = {
    price: 10_005n,
    size: 30_000n, // 3.0000 BTC
    quote: 10_007n * 10_000n + 10_005n * 20_000n, // exact sum of price*size
    cumulativeSize: 30_000n,
    cumulativeQuote: 10_007n * 10_000n + 10_005n * 20_000n,
  }

  it("shows base size at the market's size precision", () => {
    expect(rowSizeDisplay(row, "base", BTC)).toEqual({ size: "3", cumulative: "3", symbol: "BTC" })
  })

  it("shows quote value exactly, in the quote symbol", () => {
    // 100.07*1 + 100.05*2 = 300.17
    expect(rowSizeDisplay(row, "quote", BTC)).toEqual({ size: "300.17", cumulative: "300.17", symbol: "USD" })
  })

  it("labels the unit on both figures", () => {
    expect(rowSizeDisplay(row, "base", XLM).symbol).toBe("XLM")
    expect(rowSizeDisplay(row, "quote", XLM).symbol).toBe("USD")
  })
})

describe("formatBucketPrice", () => {
  it("shows at least two decimals up to the market precision", () => {
    expect(formatBucketPrice(10_000n, BTC)).toBe("100.00")
    expect(formatBucketPrice(10_005n, BTC)).toBe("100.05")
    expect(formatBucketPrice(12_345n, XLM)).toBe("0.12345")
    expect(formatBucketPrice(12_300n, XLM)).toBe("0.123")
  })
})

it("the grouping multipliers are the documented set", () => {
  expect(GROUPING_MULTIPLIERS).toEqual([1, 2, 5, 10, 50, 100, 500, 1000])
})
