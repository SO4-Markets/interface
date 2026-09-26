import { describe, expect, it } from "vitest"
import {  deduplicateAndSortTrades } from "./useRecentTrades"
import type {TradeItem} from "./useRecentTrades";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTrade(overrides: Partial<TradeItem> & { id: string }): TradeItem {
  return {
    price: 100,
    qty: 1,
    time: 1_700_000_000,
    side: "buy",
    venue: "Binance Reference",
    ...overrides,
  }
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe("deduplicateAndSortTrades", () => {
  it("returns an empty array from an empty input", () => {
    expect(deduplicateAndSortTrades([])).toEqual([])
  })

  it("keeps a single valid trade unchanged", () => {
    const t = makeTrade({ id: "1", price: 200, qty: 0.5, time: 1_700_000_000, side: "buy" })
    expect(deduplicateAndSortTrades([t])).toHaveLength(1)
  })

  it("deduplicates trades with the same id, keeping the last-seen value", () => {
    const t1 = makeTrade({ id: "42", price: 100 })
    const t2 = makeTrade({ id: "42", price: 200 })
    // Last one in the array wins (map.set overwrites)
    const result = deduplicateAndSortTrades([t1, t2])
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(200)
  })

  it("sorts newest timestamp first", () => {
    const trades = [
      makeTrade({ id: "1", time: 1_000 }),
      makeTrade({ id: "2", time: 3_000 }),
      makeTrade({ id: "3", time: 2_000 }),
    ]
    const result = deduplicateAndSortTrades(trades)
    expect(result.map((t) => t.time)).toEqual([3_000, 2_000, 1_000])
  })

  it("breaks timestamp ties by id descending", () => {
    const trades = [
      makeTrade({ id: "a", time: 1_000 }),
      makeTrade({ id: "c", time: 1_000 }),
      makeTrade({ id: "b", time: 1_000 }),
    ]
    const result = deduplicateAndSortTrades(trades)
    // localeCompare descending: c > b > a
    expect(result.map((t) => t.id)).toEqual(["c", "b", "a"])
  })

  it("bounds the result to maxRows (default 50)", () => {
    const trades = Array.from({ length: 80 }, (_, i) =>
      makeTrade({ id: String(i), time: i })
    )
    expect(deduplicateAndSortTrades(trades)).toHaveLength(50)
  })

  it("respects a custom maxRows override", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      makeTrade({ id: String(i), time: i })
    )
    expect(deduplicateAndSortTrades(trades, 5)).toHaveLength(5)
  })

  it("silently drops trades with missing id", () => {
    // @ts-expect-error — intentionally malformed
    const bad: TradeItem = { price: 100, qty: 1, time: 1_000, side: "buy", venue: "test" }
    const good = makeTrade({ id: "ok" })
    expect(deduplicateAndSortTrades([bad, good])).toHaveLength(1)
  })

  it("silently drops trades with non-positive price", () => {
    const bad = makeTrade({ id: "x", price: 0 })
    const good = makeTrade({ id: "y", price: 1 })
    expect(deduplicateAndSortTrades([bad, good])).toHaveLength(1)
  })

  it("silently drops trades with non-positive qty", () => {
    const bad = makeTrade({ id: "x", qty: -1 })
    const good = makeTrade({ id: "y", qty: 0.001 })
    expect(deduplicateAndSortTrades([bad, good])).toHaveLength(1)
  })

  it("silently drops trades with non-positive time", () => {
    const bad = makeTrade({ id: "x", time: 0 })
    const good = makeTrade({ id: "y", time: 1 })
    expect(deduplicateAndSortTrades([bad, good])).toHaveLength(1)
  })

  it("silently drops trades with NaN price", () => {
    const bad = makeTrade({ id: "x", price: NaN })
    const good = makeTrade({ id: "y" })
    expect(deduplicateAndSortTrades([bad, good])).toHaveLength(1)
  })

  it("silently drops null entries in the array", () => {
    // @ts-expect-error — intentionally malformed
    const result = deduplicateAndSortTrades([null, makeTrade({ id: "ok" })])
    expect(result).toHaveLength(1)
  })

  it("preserves 'unknown' side trades (side data is not required for inclusion)", () => {
    const t = makeTrade({ id: "u", side: "unknown" })
    expect(deduplicateAndSortTrades([t])).toHaveLength(1)
    expect(deduplicateAndSortTrades([t])[0].side).toBe("unknown")
  })

  it("is idempotent — calling twice produces the same result", () => {
    const trades = [
      makeTrade({ id: "1", time: 2_000 }),
      makeTrade({ id: "2", time: 1_000 }),
    ]
    const first = deduplicateAndSortTrades(trades)
    const second = deduplicateAndSortTrades(first)
    expect(second).toEqual(first)
  })
})
