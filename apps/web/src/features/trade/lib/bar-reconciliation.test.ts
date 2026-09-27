import { describe, expect, it } from "vitest"
import { canIncrementallyApply, candleTime, mergeBars, parseStreamBar } from "./bar-reconciliation"

const bar = (time: number, close = 100) => ({
  time,
  open: 99,
  high: Math.max(101, close),
  low: 98,
  close,
})

describe("bar reconciliation", () => {
  it("normalizes events at both sides of an interval boundary", () => {
    expect(candleTime(299, "5m")).toBe(0)
    expect(candleTime(300, "5m")).toBe(300)
    expect(candleTime(599, "5m")).toBe(300)
  })

  it("keeps the newest duplicate and sorts out-of-order updates", () => {
    expect(mergeBars(
      [bar(300), bar(600, 110)],
      [bar(300, 105), bar(0, 95), bar(300, 106)],
    )).toEqual([bar(0, 95), bar(300, 106), bar(600, 110)])
  })

  it("treats a late event as a correction without dropping neighboring bars", () => {
    const corrected = mergeBars(
      [bar(0, 100), bar(300, 110), bar(600, 120)],
      [bar(300, 115)],
    )
    expect(corrected.map((item) => item.time)).toEqual([0, 300, 600])
    expect(corrected[1]?.close).toBe(115)
  })

  it("allows current updates and contiguous appends, including duplicate frames", () => {
    expect(canIncrementallyApply([bar(0), bar(300)], [bar(300, 105)], "5m")).toBe(true)
    expect(canIncrementallyApply([bar(0), bar(300)], [bar(600), bar(600, 101)], "5m")).toBe(true)
    expect(canIncrementallyApply([bar(0), bar(300)], [bar(900)], "5m")).toBe(false)
  })

  it("merges history and stream overlap with complete OHLCV values", () => {
    const streamBar = parseStreamBar(
      { t: 300_999, o: "100", h: "125", l: "95", c: "120", v: "42" },
      "5m",
    )
    expect(streamBar).toMatchObject({ time: 300, open: 100, high: 125, low: 95, close: 120, volume: 42 })
    expect(mergeBars([bar(300, 110)], streamBar ? [streamBar] : [])).toEqual([streamBar])
  })

  it("rejects malformed stream values", () => {
    expect(parseStreamBar({ t: 300_000, o: "bad", h: "1", l: "1", c: "1" }, "5m")).toBeNull()
  })
})
