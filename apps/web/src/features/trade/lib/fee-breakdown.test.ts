import { describe, expect, it } from "vitest"
import {
  TRADE_FEE_DOCS,
  describeFeeAvailability,
  estimateFundingCost8h,
  formatFeeRateBps,
  formatPrecisePct,
  formatPreciseUsd,
  formatPreciseXlm,
} from "./fee-breakdown"

describe("fee-breakdown helpers (#1083)", () => {
  it("preserves sub-cent USD precision without rounding away small fees", () => {
    expect(formatPreciseUsd(0.051)).toBe("$0.051")
    expect(formatPreciseUsd(0.000425)).toBe("$0.000425")
    expect(formatPreciseUsd(123.4567)).toBe("$123.4567")
    expect(formatPreciseUsd(0.00000004)).toBe("$0.00000004")
    expect(formatPreciseUsd(12.34)).toBe("$12.34")
    expect(formatPreciseUsd(0)).toBe("$0.00")
    expect(formatPreciseUsd(null)).toBe("Unavailable")
    expect(formatPreciseUsd(Number.NaN)).toBe("Unavailable")
  })

  it("preserves 7-decimal Stellar stroop precision on XLM execution fees", () => {
    expect(formatPreciseXlm(0.3)).toBe("~0.30 XLM")
    expect(formatPreciseXlm(0.1234567)).toBe("~0.1234567 XLM")
    expect(formatPreciseXlm(undefined)).toBe("Unavailable")
  })

  it("preserves sub-bp percentage precision", () => {
    expect(formatPrecisePct(0.0025)).toBe("+0.0025%")
    expect(formatPrecisePct(0.125)).toBe("+0.1250%")
    expect(formatPrecisePct(0.5)).toBe("+0.50%")
    expect(formatPrecisePct(0)).toBe("0.00%")
    expect(formatPrecisePct(null)).toBe("Unavailable")
  })

  it("formats bps fee rate and 8h funding estimates", () => {
    expect(formatFeeRateBps(10)).toBe("0.10%")
    expect(formatFeeRateBps(null)).toBeNull()
    expect(estimateFundingCost8h(10_000, 0.00003)).toBeCloseTo(2.4, 8)
    expect(estimateFundingCost8h(0, 0.00003)).toBeNull()
    expect(estimateFundingCost8h(10_000, null)).toBeNull()
  })

  it("describes loading, empty, stale, insufficient, unavailable, and estimated states", () => {
    expect(describeFeeAvailability({ isLoading: true, sizeUsd: 1000, status: "unknown" }).state).toBe("loading")
    expect(describeFeeAvailability({ isLoading: false, sizeUsd: 0, status: "unknown" }).state).toBe("empty")
    expect(describeFeeAvailability({ isLoading: false, sizeUsd: 1000, status: "stale" }).state).toBe("stale")
    expect(describeFeeAvailability({ isLoading: false, sizeUsd: 1000, status: "insufficient" }).state).toBe("insufficient")
    expect(describeFeeAvailability({ isLoading: false, sizeUsd: 1000, status: "unknown" }).state).toBe("unavailable")
    expect(describeFeeAvailability({ isLoading: false, sizeUsd: 1000, status: "estimated" }).state).toBe("estimated")
  })

  it("links to funding/fees and liquidation documentation", () => {
    expect(TRADE_FEE_DOCS.overview.href).toBe("https://docs.so4.market/concepts/funding-and-fees")
    expect(TRADE_FEE_DOCS.liquidation.href).toBe("https://docs.so4.market/concepts/liquidation")
  })
})
