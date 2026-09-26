/**
 * OB-119: Trades deduplication and memory bounds tests.
 *
 * Verifies that the tape retains a bounded number of rows and deduplicates
 * correctly by stable ID.
 */

import { describe, expect, it } from "vitest"
import { deduplicateAndSortTrades } from "./useRecentTrades"
import type { TradeItem } from "./useRecentTrades"

describe("OB-119: recent trades deduplication and bounds", () => {
  const createTrade = (id: string, time: number, price = 100, qty = 1): TradeItem => ({
    id,
    price,
    qty,
    time,
    side: "buy",
    venue: "Test",
  })

  describe("deduplicateAndSortTrades", () => {
    it("removes duplicate IDs, keeping the last occurrence", () => {
      const trades = [
        createTrade("1", 1000),
        createTrade("2", 2000),
        createTrade("1", 3000), // duplicate - this one is kept
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result).toHaveLength(2)
      expect(result.map(t => t.id)).toEqual(["1", "2"]) // sorted by time desc
      // ID "1" kept with time 3000 (last occurrence)
      const trade1 = result.find(t => t.id === "1")
      expect(trade1?.time).toBe(3000)
    })

    it("sorts trades newest first by timestamp", () => {
      const trades = [
        createTrade("1", 1000),
        createTrade("2", 3000),
        createTrade("3", 2000),
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result.map(t => t.id)).toEqual(["2", "3", "1"])
    })

    it("uses ID as tiebreaker for equal timestamps", () => {
      const trades = [
        createTrade("a", 1000),
        createTrade("c", 1000),
        createTrade("b", 1000),
      ]

      const result = deduplicateAndSortTrades(trades)
      // Equal time: sort by ID lexicographically (desc)
      expect(result.map(t => t.id)).toEqual(["c", "b", "a"])
    })

    it("bounds output to maxRows (50 by default)", () => {
      const trades: Array<TradeItem> = []
      for (let i = 0; i < 100; i++) {
        trades.push(createTrade(String(i), i * 1000))
      }

      const result = deduplicateAndSortTrades(trades, 50)
      expect(result).toHaveLength(50)
      // Should keep the 50 most recent
      expect(result[0].id).toBe("99")
      expect(result[49].id).toBe("50")
    })

    it("filters out entries with invalid price or qty", () => {
      const trades = [
        createTrade("1", 1000, 100, 1),      // valid
        createTrade("2", 2000, 0, 1),        // invalid price
        createTrade("3", 3000, 100, 0),      // invalid qty
        createTrade("4", 4000, -10, 1),      // invalid price
        createTrade("5", 5000, 100, -5),     // invalid qty
        createTrade("6", 6000, NaN, 1),      // invalid price
        createTrade("7", 7000, 100, Infinity), // invalid qty
        createTrade("8", 8000, 100, 1),      // valid
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result).toHaveLength(2)
      expect(result.map(t => t.id)).toEqual(["8", "1"])
    })

    it("filters out entries with invalid timestamps", () => {
      const trades = [
        createTrade("1", 1000),
        createTrade("2", 0),        // invalid
        createTrade("3", -1000),    // invalid
        createTrade("4", NaN),      // invalid
        createTrade("5", 5000),
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result).toHaveLength(2)
      expect(result.map(t => t.id)).toEqual(["5", "1"])
    })

    it("handles empty array", () => {
      const result = deduplicateAndSortTrades([])
      expect(result).toEqual([])
    })

    it("handles all-duplicate array", () => {
      const trades = [
        createTrade("1", 1000),
        createTrade("1", 2000),
        createTrade("1", 3000),
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("1")
    })
  })

  describe("memory bounds", () => {
    it("never retains more than maxRows trades", () => {
      const trades: Array<TradeItem> = []
      // Simulate 200 trades arriving
      for (let i = 0; i < 200; i++) {
        trades.push(createTrade(String(i), i * 1000))
      }

      const result = deduplicateAndSortTrades(trades, 50)
      expect(result.length).toBeLessThanOrEqual(50)
    })

    it("discards oldest trades when bound is exceeded", () => {
      const trades: Array<TradeItem> = []
      for (let i = 0; i < 100; i++) {
        trades.push(createTrade(String(i), i * 1000))
      }

      const result = deduplicateAndSortTrades(trades, 10)
      expect(result).toHaveLength(10)
      // Should keep trades 99 down to 90
      expect(result[0].id).toBe("99")
      expect(result[9].id).toBe("90")
    })
  })

  describe("convergence under burst arrivals", () => {
    it("produces stable output regardless of arrival batching", () => {
      const initial = [createTrade("1", 1000), createTrade("2", 2000)]
      
      // Path A: add trades one at a time
      let stateA = deduplicateAndSortTrades(initial)
      stateA = deduplicateAndSortTrades([...stateA, createTrade("3", 3000)])
      stateA = deduplicateAndSortTrades([...stateA, createTrade("4", 4000)])

      // Path B: add trades in a batch
      let stateB = deduplicateAndSortTrades(initial)
      stateB = deduplicateAndSortTrades([
        ...stateB,
        createTrade("3", 3000),
        createTrade("4", 4000),
      ])

      // Both paths converge
      expect(stateA.map(t => t.id)).toEqual(stateB.map(t => t.id))
      expect(stateA.map(t => t.time)).toEqual(stateB.map(t => t.time))
    })

    it("handles rapid updates to the same trade ID", () => {
      const trades = [
        createTrade("1", 1000),
        createTrade("1", 2000),  // update
        createTrade("1", 3000),  // update
        createTrade("2", 4000),
      ]

      const result = deduplicateAndSortTrades(trades)
      expect(result).toHaveLength(2)
      expect(result.map(t => t.id)).toEqual(["2", "1"])
      // Last occurrence of ID "1" is kept (time 3000)
      const trade1 = result.find(t => t.id === "1")
      expect(trade1?.time).toBe(3000)
    })
  })
})
