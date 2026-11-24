import { expect, it } from "vitest"
import { projectIncrease } from "./PositionChangeSummary"

it("weights entry by tokens and preserves the existing fixed-point size", () => {
  const order = { existing: { sizeUsd: 100, sizeInUsdRaw: 100n * 10n ** 30n + 1n, collateralUsd: 25, entryPrice: 10, pnl: 4, liquidationPrice: 8 },
    size: 100, collateral: 25, fill: 20, mark: 18, long: true, maintenance: 50 }
  expect(projectIncrease(order)).toMatchObject({ size: "200." + "0".repeat(29) + "1", entry: 200 / 15, leverage: 4, pnl: -6 })
  expect(projectIncrease({ ...order, long: false }).pnl).toBe(14)
  expect(projectIncrease({ ...order, fill: null }).entry).toBeNull()
})
