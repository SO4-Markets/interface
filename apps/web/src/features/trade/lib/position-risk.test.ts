import { describe, expect, it } from "vitest"
import { describePositionRisk, riskSeverity } from "./position-risk"

const baseInput = {
  sizeUsd: 100_000,
  markPriceUsd: 50_000,
  liquidationPriceUsd: 45_000,
  isLong: true,
} as const

describe("position risk presentation", () => {
  it("labels a valid oracle-derived reading as an estimate", () => {
    const reading = describePositionRisk({ ...baseInput, markPriceStaleness: "fresh" })

    expect(reading.hasData).toBe(true)
    expect(reading.isEstimate).toBe(true)
    expect(reading.isStale).toBe(false)
    expect(reading.availableRiskUsd).toBe(10_000)
    expect(riskSeverity(reading)).toBe("warning")
  })

  it("keeps stale oracle state visible without hiding the estimate", () => {
    const reading = describePositionRisk({ ...baseInput, markPriceStaleness: "stale" })

    expect(reading.hasData).toBe(true)
    expect(reading.isStale).toBe(true)
  })

  it("returns an explicit unavailable state when risk inputs are missing", () => {
    const reading = describePositionRisk({
      ...baseInput,
      markPriceUsd: 0,
      markPriceStaleness: "stale",
    })

    expect(reading.hasData).toBe(false)
    expect(reading.availableRiskUsd).toBe(0)
    expect(riskSeverity(reading)).toBe("neutral")
  })
})