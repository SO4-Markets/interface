import { describe, expect, it } from "vitest"

import {
  getFundingRatePerHourPct,
  getComposition,
  getOpenInterestUsd,
  getPoolTvlUsd,
  rawToDisplay,
  usdRawToDisplay,
} from "./pool-math"

const USD_SCALE = 10n ** 30n
const TOKEN_SCALE = 10n ** 7n

describe("pool math scale conversions", () => {
  it("converts 30-decimal USD values in bigint space", () => {
    expect(usdRawToDisplay(60_000n * USD_SCALE)).toBe(60_000)
    expect(
      getPoolTvlUsd({
        poolValue: 1_234_567n * USD_SCALE,
        longTokenAmount: 0n,
        shortTokenAmount: 0n,
        longTokenUsd: 0n,
        shortTokenUsd: 0n,
        longPnl: 0n,
        shortPnl: 0n,
        netPnl: 0n,
        totalBorrowingFees: 0n,
        impactPoolAmount: 0n,
      }),
    ).toBe(1_234_567)
  })

  it("keeps 7-decimal token values on token precision", () => {
    expect(rawToDisplay(42n * TOKEN_SCALE)).toBe(42)
    expect(rawToDisplay(123_456_789n)).toBe(12.3456789)
  })

  it("converts missing and zero values to zero", () => {
    expect(rawToDisplay(undefined)).toBe(0)
    expect(usdRawToDisplay(null)).toBe(0)
    expect(getOpenInterestUsd(null)).toBe(0)
  })

  it("preserves negative USD values intentionally", () => {
    expect(usdRawToDisplay(-1_725n * USD_SCALE)).toBe(-1_725)
  })

  it("converts open interest and funding from 30-decimal USD precision", () => {
    expect(
      getOpenInterestUsd({
        long: 20_000n * USD_SCALE,
        short: 15_000n * USD_SCALE,
      }),
    ).toBe(35_000)

    const oneBasisPointPerHour = USD_SCALE / 10_000n / 3600n
    expect(getFundingRatePerHourPct(oneBasisPointPerHour)).toBeCloseTo(0.01)
  })
})

describe("pool math edge cases", () => {
  // Helper to build a zero PoolValueInfo
  function zeroPoolValue() {
    return {
      poolValue: 0n,
      longTokenAmount: 0n,
      shortTokenAmount: 0n,
      longTokenUsd: 0n,
      shortTokenUsd: 0n,
      longPnl: 0n,
      shortPnl: 0n,
      netPnl: 0n,
      totalBorrowingFees: 0n,
      impactPoolAmount: 0n,
    }
  }

  it("returns 50/50 split for getComposition when all amounts are zero", () => {
    const result = getComposition(zeroPoolValue())
    expect(result.longPct).toBe(50)
    expect(result.shortPct).toBe(50)
    expect(result.source).toBe("empty")
  })

  it("handles very large USD values without NaN or Infinity", () => {
    // 10^18 USD in 30-decimal raw form — well beyond realistic values
    const hugeUsd = 10n ** 18n * USD_SCALE
    const result = usdRawToDisplay(hugeUsd)
    expect(Number.isFinite(result)).toBe(true)
    expect(Number.isNaN(result)).toBe(false)
  })

  it("handles sub-unit token amounts (1 raw unit)", () => {
    const result = rawToDisplay(1n)
    expect(result).toBeCloseTo(1e-7)
    expect(Number.isNaN(result)).toBe(false)
    expect(Number.isFinite(result)).toBe(true)
  })

  it("getPoolTvlUsd returns 0 for null poolValue", () => {
    expect(getPoolTvlUsd(null)).toBe(0)
  })

  it("getPoolTvlUsd returns 0 for undefined poolValue", () => {
    expect(getPoolTvlUsd(undefined)).toBe(0)
  })

  it("getFundingRatePerHourPct returns 0 for null input", () => {
    expect(getFundingRatePerHourPct(null)).toBe(0)
  })

  it("getFundingRatePerHourPct returns 0 for undefined input", () => {
    expect(getFundingRatePerHourPct(undefined)).toBe(0)
  })

  it("no math function returns NaN or Infinity for extreme inputs", () => {
    const extremeUsd = 10n ** 30n * USD_SCALE
    const extremeToken = 10n ** 20n * TOKEN_SCALE

    const checks = [
      usdRawToDisplay(extremeUsd),
      usdRawToDisplay(-extremeUsd),
      rawToDisplay(extremeToken),
      getPoolTvlUsd({ ...zeroPoolValue(), poolValue: extremeUsd }),
      getFundingRatePerHourPct(extremeUsd),
      getOpenInterestUsd({ long: extremeUsd, short: extremeUsd }),
    ]

    for (const value of checks) {
      expect(Number.isNaN(value)).toBe(false)
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})
