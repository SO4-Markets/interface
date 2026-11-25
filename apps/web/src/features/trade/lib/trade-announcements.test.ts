import { describe, expect, it } from "vitest"
import {
  evaluateLiquidationWarnings,
  orderEventAnnouncement,
} from "./trade-announcements"
import type { LiquidationWatchPosition } from "./trade-announcements"

function position(overrides: Partial<LiquidationWatchPosition> = {}): LiquidationWatchPosition {
  return {
    key: "btc-long",
    marketName: "BTC/USD",
    isLong: true,
    sizeUsd: 10_000,
    markPrice: 100,
    liquidationPrice: 80,
    ...overrides,
  }
}

describe("orderEventAnnouncement (issue 956)", () => {
  it("announces fills only", () => {
    expect(orderEventAnnouncement("OrderExecuted")).toMatch(/order filled/i)
    expect(orderEventAnnouncement("OrderCreated")).toBeNull()
    expect(orderEventAnnouncement("OrderCancelled")).toBeNull()
    expect(orderEventAnnouncement("OrderUpdated")).toBeNull()
  })
})

describe("evaluateLiquidationWarnings (issue 956)", () => {
  it("stays silent while positions are outside the danger band", () => {
    const result = evaluateLiquidationWarnings([position()], new Set())
    expect(result.messages).toEqual([])
    expect(result.warned.size).toBe(0)
  })

  it("warns once when a long enters the ≤5% band, naming market, side and distance", () => {
    const first = evaluateLiquidationWarnings([position({ markPrice: 84 })], new Set())
    expect(first.messages).toEqual([
      "Liquidation warning: BTC/USD long is 4.8% from its liquidation price.",
    ])

    const again = evaluateLiquidationWarnings([position({ markPrice: 83 })], first.warned)
    expect(again.messages).toEqual([])
    expect(again.warned.has("btc-long")).toBe(true)
  })

  it("handles shorts and sub-1% distances", () => {
    const result = evaluateLiquidationWarnings(
      [position({ key: "eth-short", marketName: "ETH/USD", isLong: false, markPrice: 100, liquidationPrice: 100.5 })],
      new Set(),
    )
    expect(result.messages).toEqual([
      "Liquidation warning: ETH/USD short is 0.50% from its liquidation price.",
    ])
  })

  it("re-arms only after recovering past the clear threshold", () => {
    const warned = new Set(["btc-long"])
    // 6% away: out of danger but not clearly recovered — stays armed-off.
    const hovering = evaluateLiquidationWarnings([position({ markPrice: 85.2 })], warned)
    expect(hovering.warned.has("btc-long")).toBe(true)

    // 20% away: recovered, so a later dip warns again.
    const recovered = evaluateLiquidationWarnings([position()], hovering.warned)
    expect(recovered.warned.has("btc-long")).toBe(false)
    const dipped = evaluateLiquidationWarnings([position({ markPrice: 82 })], recovered.warned)
    expect(dipped.messages).toHaveLength(1)
  })

  it("forgets closed positions and ignores rows without risk data", () => {
    const result = evaluateLiquidationWarnings(
      [position({ key: "no-liq", liquidationPrice: 0 })],
      new Set(["closed"]),
    )
    expect(result.warned.size).toBe(0)
    expect(result.messages).toEqual([])
  })
})
