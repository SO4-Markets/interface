import { describe, expect, it } from "vitest"
import {
  POSITION_REFRESH_MAP,
  positionRefreshKeys,
} from "./position-refresh"

describe("position action refresh map", () => {
  it("refreshes positions, orders, balances, and history after a close", () => {
    expect(POSITION_REFRESH_MAP.close).toEqual([
      "positionsFresh",
      "positions",
      "orders",
      "tokenBalances",
      "indexerPositions",
      "indexerOrders",
      "indexerTradeHistory",
    ])
  })

  it("keeps collateral changes scoped to affected position data and balances", () => {
    expect(POSITION_REFRESH_MAP["add-collateral"]).toEqual([
      "positionsFresh",
      "positions",
      "tokenBalances",
      "indexerPositions",
    ])
    expect(POSITION_REFRESH_MAP["remove-collateral"]).toEqual(
      POSITION_REFRESH_MAP["add-collateral"],
    )
  })

  it("isolates refresh keys by account and includes every history filter prefix", () => {
    const keys = positionRefreshKeys("GACCOUNT")

    expect(keys.indexerOrders).toHaveLength(2)
    expect(keys.indexerTradeHistory).toHaveLength(2)
    expect(keys.indexerOrders[0]).toContain("GACCOUNT")
    expect(keys.indexerTradeHistory[1]).toContain("GACCOUNT")
  })
})