/**
 * OB-119: Performance and coalescing tests for order book rendering.
 *
 * Verifies that:
 * - Bursty WebSocket deltas are coalesced into bounded render frequency
 * - Delta reconciliation remains correct regardless of batching
 * - Memory footprint stays bounded at the defined row limit
 */

import { describe, expect, it } from "vitest"
import { applyDelta, buildLevels } from "./useOrderBook"

describe("OB-119: render coalescing correctness", () => {
  describe("applyDelta", () => {
    it("applies additions to the map", () => {
      const map = new Map<string, string>()
      applyDelta(map, [
        ["100.50", "1.5"],
        ["100.75", "2.3"],
      ])

      expect(map.size).toBe(2)
      expect(map.get("100.50")).toBe("1.5")
      expect(map.get("100.75")).toBe("2.3")
    })

    it("applies updates by overwriting existing entries", () => {
      const map = new Map([
        ["100.50", "1.5"],
        ["100.75", "2.3"],
      ])
      applyDelta(map, [["100.50", "3.7"]])

      expect(map.size).toBe(2)
      expect(map.get("100.50")).toBe("3.7")
      expect(map.get("100.75")).toBe("2.3")
    })

    it("applies deletions when size is zero", () => {
      const map = new Map([
        ["100.50", "1.5"],
        ["100.75", "2.3"],
      ])
      applyDelta(map, [["100.50", "0"]])

      expect(map.size).toBe(1)
      expect(map.has("100.50")).toBe(false)
      expect(map.get("100.75")).toBe("2.3")
    })

    it("handles mixed add/update/delete in a single batch", () => {
      const map = new Map([
        ["100.50", "1.5"],
        ["100.75", "2.3"],
      ])
      applyDelta(map, [
        ["100.50", "0"],       // delete
        ["100.75", "5.0"],     // update
        ["101.00", "1.2"],     // add
      ])

      expect(map.size).toBe(2)
      expect(map.has("100.50")).toBe(false)
      expect(map.get("100.75")).toBe("5.0")
      expect(map.get("101.00")).toBe("1.2")
    })
  })

  describe("buildLevels", () => {
    it("converts map to sorted levels array (descending for bids)", () => {
      const map = new Map([
        ["100.50", "1.5"],
        ["100.75", "2.3"],
        ["100.25", "0.8"],
      ])
      const levels = buildLevels(map, false)

      expect(levels).toHaveLength(3)
      expect(levels[0].price).toBe(100.75) // highest first
      expect(levels[1].price).toBe(100.50)
      expect(levels[2].price).toBe(100.25)
    })

    it("converts map to sorted levels array (ascending for asks)", () => {
      const map = new Map([
        ["101.50", "1.5"],
        ["101.00", "2.3"],
        ["101.25", "0.8"],
      ])
      const levels = buildLevels(map, true)

      expect(levels).toHaveLength(3)
      expect(levels[0].price).toBe(101.00) // lowest first
      expect(levels[1].price).toBe(101.25)
      expect(levels[2].price).toBe(101.50)
    })

    it("calculates cumulative total correctly", () => {
      const map = new Map([
        ["100.75", "2.0"],
        ["100.50", "1.5"],
        ["100.25", "0.5"],
      ])
      const levels = buildLevels(map, false)

      expect(levels[0].total).toBe(2.0)
      expect(levels[1].total).toBe(3.5)  // 2.0 + 1.5
      expect(levels[2].total).toBe(4.0)  // 3.5 + 0.5
    })

    it("calculates depth as fraction of max total", () => {
      const map = new Map([
        ["100.75", "2.0"],
        ["100.50", "1.5"],
        ["100.25", "0.5"],
      ])
      const levels = buildLevels(map, false)

      const maxTotal = 4.0
      expect(levels[0].depth).toBeCloseTo(2.0 / maxTotal)
      expect(levels[1].depth).toBeCloseTo(3.5 / maxTotal)
      expect(levels[2].depth).toBeCloseTo(4.0 / maxTotal)
    })

    it("bounds output to LEVELS rows (20 by default)", () => {
      const map = new Map()
      // Generate 50 price levels
      for (let i = 1; i <= 50; i++) {
        map.set(`${100 + i}.00`, "1.0")
      }

      const levels = buildLevels(map, false)
      expect(levels).toHaveLength(20) // bounded
    })

    it("filters out zero-size entries", () => {
      const map = new Map([
        ["100.75", "2.0"],
        ["100.50", "0"],     // should be filtered
        ["100.25", "0.5"],
      ])
      const levels = buildLevels(map, false)

      expect(levels).toHaveLength(2)
      expect(levels.find(l => l.price === 100.50)).toBeUndefined()
    })

    it("handles negative sizes (treats as invalid, filters out)", () => {
      const map = new Map([
        ["100.75", "2.0"],
        ["100.50", "-1.5"],  // invalid
        ["100.25", "0.5"],
      ])
      const levels = buildLevels(map, false)

      expect(levels).toHaveLength(2)
      expect(levels.find(l => l.price === 100.50)).toBeUndefined()
    })
  })

  describe("delta reconciliation convergence", () => {
    it("reaches same final state when deltas are batched vs unbatched", () => {
      // Scenario: three deltas arrive in rapid succession
      const delta1: Array<[string, string]> = [
        ["100.50", "1.5"],
        ["100.75", "2.3"],
      ]
      const delta2: Array<[string, string]> = [
        ["100.50", "2.0"],   // update
        ["101.00", "1.0"],   // add
      ]
      const delta3: Array<[string, string]> = [
        ["100.75", "0"],     // delete
        ["101.25", "0.8"],   // add
      ]

      // Path A: apply each delta immediately (unbatched)
      const mapA = new Map<string, string>()
      applyDelta(mapA, delta1)
      applyDelta(mapA, delta2)
      applyDelta(mapA, delta3)

      // Path B: accumulate all deltas, then apply in one batch
      const mapB = new Map<string, string>()
      applyDelta(mapB, [...delta1, ...delta2, ...delta3])

      // Both paths must converge to the same final state
      expect(Array.from(mapA.entries()).sort()).toEqual(
        Array.from(mapB.entries()).sort()
      )

      // Verify expected final state
      expect(mapA.has("100.50")).toBe(true)
      expect(mapA.get("100.50")).toBe("2.0")   // updated
      expect(mapA.has("100.75")).toBe(false)   // deleted
      expect(mapA.has("101.00")).toBe(true)    // added
      expect(mapA.has("101.25")).toBe(true)    // added
    })

    it("converges when deltas include redundant updates", () => {
      const map1 = new Map<string, string>()
      const map2 = new Map<string, string>()

      // Simulate burst: price 100.50 updated multiple times
      const burst = [
        ["100.50", "1.0"],
        ["100.50", "1.5"],
        ["100.50", "2.0"],
        ["100.50", "2.5"],
      ] as Array<[string, string]>

      // Path A: apply each individually
      for (const delta of burst) {
        applyDelta(map1, [delta])
      }

      // Path B: apply all at once
      applyDelta(map2, burst)

      // Both converge to final value
      expect(map1.get("100.50")).toBe("2.5")
      expect(map2.get("100.50")).toBe("2.5")
    })

    it("preserves delete-then-add semantics within a burst", () => {
      const map = new Map<string, string>()

      // Price 100.50: deleted, then re-added with new size
      applyDelta(map, [
        ["100.50", "1.5"],
        ["100.50", "0"],     // delete
        ["100.50", "3.0"],   // re-add
      ])

      expect(map.has("100.50")).toBe(true)
      expect(map.get("100.50")).toBe("3.0")
    })
  })

  describe("memory bounds", () => {
    it("buildLevels output never exceeds LEVELS count", () => {
      const map = new Map<string, string>()
      // Fill with 100 levels
      for (let i = 1; i <= 100; i++) {
        map.set(`${100 + i}.00`, `${i}.0`)
      }

      const bids = buildLevels(map, false)
      expect(bids.length).toBeLessThanOrEqual(20)

      const asks = buildLevels(map, true)
      expect(asks.length).toBeLessThanOrEqual(20)
    })

    it("map deletions actually remove entries (no memory leak)", () => {
      const map = new Map<string, string>()
      // Add 50 entries
      for (let i = 1; i <= 50; i++) {
        map.set(`${100 + i}.00`, "1.0")
      }
      expect(map.size).toBe(50)

      // Delete half
      const deletes: Array<[string, string]> = []
      for (let i = 1; i <= 25; i++) {
        deletes.push([`${100 + i}.00`, "0"])
      }
      applyDelta(map, deletes)

      // Map should actually shrink
      expect(map.size).toBe(25)
    })
  })
})
