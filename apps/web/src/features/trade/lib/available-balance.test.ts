import { describe, expect, it } from "vitest"
import {
  calculateAvailableBalance,
  getPercentageAmount,
  canExecuteAmount,
} from "./available-balance"

describe("calculateAvailableBalance", () => {
  const params = {
    minExecutionFeeXlm: 0.3,
    xlmPrice: 0.17,
  }

  it("returns available balance after deducting all fees", () => {
    const result = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: 50,
      ...params,
    })
    // 1000 - 50 (fees) - 0.051 (0.3 * 0.17) = 949.949
    expect(result).toBeCloseTo(949.95, 1)
  })

  it("returns 0 when balance is insufficient for fees", () => {
    const result = calculateAvailableBalance({
      walletBalance: 10,
      totalFeesUsd: 15,
      ...params,
    })
    expect(result).toBe(0)
  })

  it("handles zero balance", () => {
    const result = calculateAvailableBalance({
      walletBalance: 0,
      totalFeesUsd: 10,
      ...params,
    })
    expect(result).toBe(0)
  })

  it("accounts for execution fee XLM price", () => {
    const result = calculateAvailableBalance({
      walletBalance: 100,
      totalFeesUsd: 5,
      minExecutionFeeXlm: 0.5,
      xlmPrice: 0.20,
    })
    // 100 - 5 - (0.5 * 0.20) = 100 - 5 - 0.1 = 94.9
    expect(result).toBeCloseTo(94.9, 1)
  })
})

describe("getPercentageAmount", () => {
  it("calculates 25% of available balance", () => {
    const result = getPercentageAmount(1000, 25)
    expect(result).toBe(250)
  })

  it("calculates 50% of available balance", () => {
    const result = getPercentageAmount(1000, 50)
    expect(result).toBe(500)
  })

  it("calculates 75% of available balance", () => {
    const result = getPercentageAmount(1000, 75)
    expect(result).toBe(750)
  })

  it("calculates 100% (MAX) of available balance", () => {
    const result = getPercentageAmount(1000, 100)
    expect(result).toBe(1000)
  })

  it("returns 0 for zero balance", () => {
    const result = getPercentageAmount(0, 50)
    expect(result).toBe(0)
  })

  it("returns 0 for invalid percentage (>100)", () => {
    const result = getPercentageAmount(1000, 150)
    expect(result).toBe(0)
  })

  it("returns 0 for negative percentage", () => {
    const result = getPercentageAmount(1000, -10)
    expect(result).toBe(0)
  })

  it("returns 0 for zero percentage", () => {
    const result = getPercentageAmount(1000, 0)
    expect(result).toBe(0)
  })

  it("handles fractional percentages", () => {
    const result = getPercentageAmount(1000, 33.33)
    expect(result).toBeCloseTo(333.3, 1)
  })
})

describe("canExecuteAmount", () => {
  it("returns true when amount + fees fit in available balance", () => {
    const result = canExecuteAmount(400, 1000, 100)
    // 400 + 100 = 500 <= 1000
    expect(result).toBe(true)
  })

  it("returns false when amount + fees exceed available balance", () => {
    const result = canExecuteAmount(600, 1000, 500)
    // 600 + 500 = 1100 > 1000
    expect(result).toBe(false)
  })

  it("returns false for zero balance", () => {
    const result = canExecuteAmount(100, 0, 10)
    expect(result).toBe(false)
  })

  it("returns false for zero amount", () => {
    const result = canExecuteAmount(0, 1000, 10)
    expect(result).toBe(false)
  })

  it("returns false for negative amount", () => {
    const result = canExecuteAmount(-100, 1000, 10)
    expect(result).toBe(false)
  })

  it("returns true when amount equals available balance minus fees", () => {
    const result = canExecuteAmount(900, 1000, 100)
    // 900 + 100 = 1000
    expect(result).toBe(true)
  })
})

describe("OB-073 fixture tests: percentage sizing without exceeding balance", () => {
  const totalFees = 50 // $50 in fees
  const xlmFee = 0.3 * 0.17 // ~$0.05

  it("0% sizing: should be 0 and safe", () => {
    const available = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 0)
    expect(amount).toBe(0)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })

  it("25% sizing: should not exceed available", () => {
    const available = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 25)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })

  it("50% sizing: should not exceed available", () => {
    const available = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 50)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })

  it("75% sizing: should not exceed available", () => {
    const available = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 75)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })

  it("100% (MAX) sizing: should not exceed available", () => {
    const available = calculateAvailableBalance({
      walletBalance: 1000,
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 100)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })

  it("MAX with insufficient balance: should safely restrict sizing", () => {
    const available = calculateAvailableBalance({
      walletBalance: 100, // Only $100
      totalFeesUsd: totalFees,
      minExecutionFeeXlm: 0.3,
      xlmPrice: 0.17,
    })
    const amount = getPercentageAmount(available, 100)
    // Available should be ~49.95 after fees
    expect(available).toBeLessThan(50)
    expect(amount).toBeLessThan(50)
    expect(canExecuteAmount(amount, available, totalFees)).toBe(true)
  })
})
