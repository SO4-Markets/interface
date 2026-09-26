import { beforeEach, describe, expect, it } from "vitest"
import {
  MAX_REMEMBERED_MARKETS,
  ORDERBOOK_DISPLAY_STORAGE_KEY,
  selectDisplayPrefs,
  useOrderBookDisplayStore,
} from "./orderbook-display-store"
import type { MarketDisplayMetadata } from "../lib/orderbook/display-prefs"

const meta = (marketId: string, tickSize = 1n): MarketDisplayMetadata => ({
  marketId,
  baseSymbol: marketId.split("-")[0],
  quoteSymbol: "USD",
  priceScale: 2,
  sizeScale: 4,
  tickSize,
})

const BTC = meta("BTC-USD")
const XLM = meta("XLM-USD", 10n)

const store = () => useOrderBookDisplayStore.getState()

beforeEach(() => {
  localStorage.clear()
  useOrderBookDisplayStore.setState({ layout: "both", byMarket: {} })
})

describe("defaults", () => {
  it("starts with both sides, native grouping and base units", () => {
    expect(store().layout).toBe("both")
    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 1, unit: "base" })
  })
})

describe("per-market preferences", () => {
  it("remembers grouping and unit separately for each market", () => {
    store().setGrouping(BTC, 10)
    store().setUnit("BTC-USD", "quote")
    store().setGrouping(XLM, 5)

    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 10, unit: "quote" })
    expect(selectDisplayPrefs(store(), XLM)).toEqual({ groupingMultiplier: 5, unit: "base" })
  })

  it("survives switching between markets with different tick sizes", () => {
    store().setGrouping(BTC, 100)
    store().setGrouping(XLM, 2)
    // Back and forth: each keeps its own multiplier and the other is not disturbed.
    expect(selectDisplayPrefs(store(), BTC).groupingMultiplier).toBe(100)
    expect(selectDisplayPrefs(store(), XLM).groupingMultiplier).toBe(2)
    expect(selectDisplayPrefs(store(), BTC).groupingMultiplier).toBe(100)
  })

  it("setting the unit keeps the grouping, and vice versa", () => {
    store().setGrouping(BTC, 50)
    store().setUnit("BTC-USD", "quote")
    store().setGrouping(BTC, 5)
    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 5, unit: "quote" })
  })

  it("refuses a grouping the market does not offer", () => {
    store().setGrouping(BTC, 7)
    store().setGrouping({ ...BTC, tickSize: 0n }, 10)
    expect(store().byMarket["BTC-USD"]).toBeUndefined()
  })

  it("refuses an unknown unit or layout", () => {
    store().setUnit("BTC-USD", "lots" as never)
    store().setLayout("sideways" as never)
    expect(store().byMarket).toEqual({})
    expect(store().layout).toBe("both")
  })
})

describe("reconcileMarket", () => {
  it("resets a stored grouping the market stopped offering, and reports it", () => {
    store().setGrouping(BTC, 100)
    // The market's capabilities change: no metadata usable any more.
    const reset = store().reconcileMarket({ ...BTC, tickSize: 0n })

    expect(reset).toEqual({ grouping: true, unit: false })
    expect(store().byMarket["BTC-USD"]).toEqual({ groupingMultiplier: 1, unit: "base" })
  })

  it("leaves valid preferences alone and reports no reset", () => {
    store().setGrouping(BTC, 10)
    const before = store().byMarket
    expect(store().reconcileMarket(BTC)).toEqual({ grouping: false, unit: false })
    expect(store().byMarket).toBe(before)
  })

  it("does nothing for a market with no stored preferences", () => {
    expect(store().reconcileMarket(BTC)).toEqual({ grouping: false, unit: false })
    expect(store().byMarket).toEqual({})
  })

  it("selectDisplayPrefs never returns an invalid value even before reconcile runs", () => {
    useOrderBookDisplayStore.setState({ byMarket: { "BTC-USD": { groupingMultiplier: 7, unit: "quote" } } })
    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 1, unit: "quote" })
  })
})

describe("layout", () => {
  it("stores the layout globally", () => {
    store().setLayout("bids")
    expect(store().layout).toBe("bids")
    store().setGrouping(BTC, 10)
    expect(store().layout).toBe("bids")
  })

  it("changing the layout does not touch grouping or unit", () => {
    store().setGrouping(BTC, 10)
    store().setUnit("BTC-USD", "quote")
    store().setLayout("asks")
    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 10, unit: "quote" })
  })
})

describe("bounded memory", () => {
  it("forgets the least recently changed markets past the cap", () => {
    for (let i = 0; i < MAX_REMEMBERED_MARKETS + 5; i++) {
      store().setUnit(`M${i}-USD`, "quote")
    }
    const ids = Object.keys(store().byMarket)
    expect(ids).toHaveLength(MAX_REMEMBERED_MARKETS)
    expect(ids).not.toContain("M0-USD")
    expect(ids).toContain(`M${MAX_REMEMBERED_MARKETS + 4}-USD`)
  })

  it("changing a market again makes it the newest, not the oldest", () => {
    store().setUnit("OLD-USD", "quote")
    for (let i = 0; i < MAX_REMEMBERED_MARKETS - 1; i++) store().setUnit(`M${i}-USD`, "quote")
    store().setUnit("OLD-USD", "base") // refreshed
    store().setUnit("NEW-USD", "quote") // would have evicted OLD if it were still oldest
    expect(Object.keys(store().byMarket)).toContain("OLD-USD")
  })
})

describe("persistence and recovery", () => {
  it("writes only layout and per-market preferences", () => {
    store().setLayout("bids")
    store().setGrouping(BTC, 10)
    const saved = JSON.parse(localStorage.getItem(ORDERBOOK_DISPLAY_STORAGE_KEY)!)
    expect(saved.version).toBe(1)
    expect(Object.keys(saved.state).sort()).toEqual(["byMarket", "layout"])
    expect(saved.state.byMarket["BTC-USD"]).toEqual({ groupingMultiplier: 10, unit: "base" })
  })

  it("rehydrates saved preferences", async () => {
    localStorage.setItem(
      ORDERBOOK_DISPLAY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: { layout: "asks", byMarket: { "BTC-USD": { groupingMultiplier: 50, unit: "quote" } } },
      }),
    )
    await useOrderBookDisplayStore.persist.rehydrate()
    expect(store().layout).toBe("asks")
    expect(selectDisplayPrefs(store(), BTC)).toEqual({ groupingMultiplier: 50, unit: "quote" })
  })

  it.each([
    ["not an object", JSON.stringify({ version: 1, state: "garbage" })],
    ["unknown layout", JSON.stringify({ version: 1, state: { layout: "diagonal", byMarket: {} } })],
    ["byMarket is an array", JSON.stringify({ version: 1, state: { layout: "bids", byMarket: [1, 2] } })],
  ])("recovers from corrupt storage: %s", async (_label, raw) => {
    localStorage.setItem(ORDERBOOK_DISPLAY_STORAGE_KEY, raw)
    await useOrderBookDisplayStore.persist.rehydrate()
    expect(["both", "bids"]).toContain(store().layout)
    expect(store().byMarket).toEqual({})
  })

  it("drops malformed market entries but keeps the good ones", async () => {
    localStorage.setItem(
      ORDERBOOK_DISPLAY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          layout: "both",
          byMarket: {
            "BTC-USD": { groupingMultiplier: 10, unit: "quote" },
            "BAD-1": { groupingMultiplier: "10", unit: "quote" },
            "BAD-2": { groupingMultiplier: 0, unit: "base" },
            "BAD-3": { groupingMultiplier: 5, unit: "lots" },
            "BAD-4": null,
          },
        },
      }),
    )
    await useOrderBookDisplayStore.persist.rehydrate()
    expect(Object.keys(store().byMarket)).toEqual(["BTC-USD"])
  })

  it("caps an oversized stored list on load", async () => {
    const byMarket = Object.fromEntries(
      Array.from({ length: MAX_REMEMBERED_MARKETS + 20 }, (_, i) => [`M${i}`, { groupingMultiplier: 1, unit: "base" }]),
    )
    localStorage.setItem(ORDERBOOK_DISPLAY_STORAGE_KEY, JSON.stringify({ version: 1, state: { layout: "both", byMarket } }))
    await useOrderBookDisplayStore.persist.rehydrate()
    expect(Object.keys(store().byMarket)).toHaveLength(MAX_REMEMBERED_MARKETS)
  })

  it("reset clears everything", () => {
    store().setLayout("bids")
    store().setGrouping(BTC, 10)
    store().reset()
    expect(store().layout).toBe("both")
    expect(store().byMarket).toEqual({})
  })
})
