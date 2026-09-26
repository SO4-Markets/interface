// OB-119: coalescing render frequency must never change the final,
// converged book state — a high-rate replay of deltas has to produce the
// same result whether every delta gets its own render or a burst of them
// is batched into one. These tests exercise the pure reconciliation
// primitives (`applyDelta`, `buildLevels`) that `schedulePublish()` reads
// from, independent of the WS/rAF scheduling around them.

import { describe, expect, it } from "vitest"
import { applyDelta, buildLevels } from "./useOrderBook"

describe("applyDelta", () => {
  it("sets a price level's size", () => {
    const map = new Map<string, string>()
    applyDelta(map, [["100.00", "1.5"]])
    expect(map.get("100.00")).toBe("1.5")
  })

  it("removes a price level when size drops to zero", () => {
    const map = new Map<string, string>([["100.00", "1.5"]])
    applyDelta(map, [["100.00", "0"]])
    expect(map.has("100.00")).toBe(false)
  })

  it("converges to the same final state whether deltas are applied one at a time or as one batch", () => {
    const deltas: Array<[string, string]> = [
      ["100.00", "1.0"],
      ["100.00", "1.5"], // update
      ["101.00", "2.0"],
      ["100.00", "0"], // remove
      ["102.00", "0.5"],
      ["101.00", "2.5"], // update
    ]

    const perMessage = new Map<string, string>()
    for (const delta of deltas) applyDelta(perMessage, [delta])

    const batched = new Map<string, string>()
    applyDelta(batched, deltas)

    expect(Array.from(batched.entries())).toEqual(Array.from(perMessage.entries()))
    expect(batched.has("100.00")).toBe(false)
    expect(batched.get("101.00")).toBe("2.5")
    expect(batched.get("102.00")).toBe("0.5")
  })

  it("conserves every surviving level across a high-rate replay (no dropped deltas)", () => {
    const map = new Map<string, string>()
    const deltas: Array<[string, string]> = Array.from({ length: 200 }, (_, i) => [
      (100 + (i % 50) * 0.01).toFixed(2),
      String(1 + (i % 5)),
    ])

    for (const delta of deltas) applyDelta(map, [delta])

    // Every distinct price touched by the replay ends up with the size
    // from its *last* occurrence in the sequence — nothing is skipped and
    // nothing lingers from an earlier, superseded delta.
    const lastByPrice = new Map<string, string>()
    for (const [price, size] of deltas) lastByPrice.set(price, size)

    expect(map.size).toBe(lastByPrice.size)
    for (const [price, size] of lastByPrice) {
      expect(map.get(price)).toBe(size)
    }
  })
})

describe("buildLevels", () => {
  it("sorts descending for bids and computes cumulative depth", () => {
    const bids = new Map([
      ["100.00", "1"],
      ["101.00", "2"],
      ["99.00", "0.5"],
    ])
    const levels = buildLevels(bids, false)
    expect(levels.map((l) => l.price)).toEqual([101, 100, 99])
    expect(levels[0].total).toBeCloseTo(2)
    expect(levels[1].total).toBeCloseTo(3)
    expect(levels[2].total).toBeCloseTo(3.5)
    expect(levels[2].depth).toBeCloseTo(1) // max total is the last cumulative value
  })

  it("sorts ascending for asks", () => {
    const asks = new Map([
      ["101.00", "1"],
      ["100.00", "2"],
    ])
    const levels = buildLevels(asks, true)
    expect(levels.map((l) => l.price)).toEqual([100, 101])
  })

  it("excludes zero-size entries", () => {
    const bids = new Map([
      ["100.00", "1"],
      ["99.00", "0"],
    ])
    const levels = buildLevels(bids, false)
    expect(levels).toHaveLength(1)
    expect(levels[0].price).toBe(100)
  })
})
