import { describe, expect, it } from "vitest"
import {
  describePositionRisk,
  describePositionRiskMeter,
  pickHighestRiskPosition,
  riskSeverity,
} from "./position-risk"

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

  it("derives meter scores, semantic thresholds, and text equivalents across risk bands", () => {
    const safe = describePositionRiskMeter(
      describePositionRisk({
        ...baseInput,
        markPriceUsd: 60_000,
        liquidationPriceUsd: 45_000,
        markPriceStaleness: "fresh",
      }),
    )
    expect(safe.level).toBe("safe")
    expect(safe.threshold).toBe("success")
    expect(safe.statusLabel).toBe("Safe")
    expect(safe.riskScore).toBe(50)

    const warning = describePositionRiskMeter(
      describePositionRisk({ ...baseInput, markPriceStaleness: "fresh" }),
    )
    expect(warning.level).toBe("warning")
    expect(warning.threshold).toBe("warning")
    expect(warning.statusLabel).toBe("Warning")
    expect(warning.riskScore).toBe(80)

    const critical = describePositionRiskMeter(
      describePositionRisk({
        ...baseInput,
        markPriceUsd: 46_000,
        liquidationPriceUsd: 45_000,
        markPriceStaleness: "fresh",
      }),
    )
    expect(critical.level).toBe("danger")
    expect(critical.threshold).toBe("danger")
    expect(critical.statusLabel).toBe("Critical")
    expect(critical.riskScore).toBeGreaterThanOrEqual(95)

    const unavailable = describePositionRiskMeter(
      describePositionRisk({
        ...baseInput,
        markPriceUsd: 0,
        markPriceStaleness: "fresh",
      }),
    )
    expect(unavailable.level).toBe("unavailable")
    expect(unavailable.threshold).toBe("neutral")
    expect(unavailable.riskScore).toBe(0)
  })

  it("picks the position closest to liquidation", () => {
    const picked = pickHighestRiskPosition(
      [
        {
          key: "safe",
          sizeUsd: 10_000,
          markPrice: 100,
          liquidationPrice: 70,
          isLong: true,
          indexToken: "ETH",
        },
        {
          key: "risky",
          sizeUsd: 10_000,
          markPrice: 100,
          liquidationPrice: 97,
          isLong: true,
          indexToken: "BTC",
        },
      ],
      () => "fresh",
    )

    expect(picked?.position.key).toBe("risky")
  })
})