import { describe, expect, it } from "vitest"
import { clampLeverage, estimatePositionRisk, getRiskState } from "./risk"

const risk = (overrides: Partial<Parameters<typeof estimatePositionRisk>[0]["risk"]> = {}) => ({
  maxLeverage: 20,
  maintenanceMarginRateBps: 50,
  updatedAt: Date.now(),
  ...overrides,
})

describe("source-driven trade risk", () => {
  it("clamps leverage at the source maximum", () => {
    expect(clampLeverage(25, 20)).toBe(20)
    expect(clampLeverage(0.5, 20)).toBe(1)
  })

  it("recomputes notional and margin when collateral changes", () => {
    const first = estimatePositionRisk({
      collateralUsd: 100,
      leverage: 10,
      entryPrice: 1_000,
      isLong: true,
      risk: risk(),
    })
    const second = estimatePositionRisk({
      collateralUsd: 250,
      leverage: 10,
      entryPrice: 1_000,
      isLong: true,
      risk: risk(),
    })
    expect(first).toMatchObject({ collateralUsd: 100, notionalUsd: 1_000 })
    expect(second).toMatchObject({ collateralUsd: 250, notionalUsd: 2_500 })
  })

  it("includes existing exposure in the estimate", () => {
    const estimate = estimatePositionRisk({
      collateralUsd: 100,
      leverage: 10,
      entryPrice: 1_000,
      isLong: true,
      risk: risk(),
      existing: { sizeUsd: 500, collateralUsd: 75, entryPrice: 900 },
    })
    expect(estimate).toMatchObject({ collateralUsd: 100, notionalUsd: 1_500 })
    expect(estimate?.liquidationPrice).toBeLessThan(1_000)
  })

  it("does not estimate when risk is unavailable or stale", () => {
    expect(getRiskState(null)).toBe("unavailable")
    expect(getRiskState(risk({ updatedAt: Date.now() - 6 * 60 * 1000 }))).toBe("stale")
    expect(estimatePositionRisk({
      collateralUsd: 100,
      leverage: 10,
      entryPrice: 1_000,
      isLong: true,
      risk: risk({ updatedAt: Date.now() - 6 * 60 * 1000 }),
    })).toBeNull()
  })

  it("does not show a precise liquidation value without maintenance margin", () => {
    const estimate = estimatePositionRisk({
      collateralUsd: 100,
      leverage: 10,
      entryPrice: 1_000,
      isLong: true,
      risk: risk({ maintenanceMarginRateBps: null }),
    })
    expect(estimate).toMatchObject({ notionalUsd: 1_000, liquidationPrice: null })
  })
})
