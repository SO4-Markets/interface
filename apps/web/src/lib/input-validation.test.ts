import { describe, expect, it } from "vitest"
import {
  validateAmount,
  validatePrice,
  validateTick,
  validateLot,
  validateMinNotional,
  validateBalance,
} from "./input-validation"

// ─────────────────────────────────────────────────────────────────────────────
// validateAmount
// ─────────────────────────────────────────────────────────────────────────────

describe("validateAmount", () => {
  it("passes for valid positive amount", () => {
    const result = validateAmount("100")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("passes for decimal amount", () => {
    const result = validateAmount("1.5")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails for empty string", () => {
    const result = validateAmount("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter an amount")
  })

  it("fails for whitespace-only input", () => {
    const result = validateAmount("   ")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter an amount")
  })

  it("fails for zero", () => {
    const result = validateAmount("0")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Amount must be greater than zero")
  })

  it("fails for negative input", () => {
    const result = validateAmount("-5")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter a valid amount")
  })

  it("fails for non-numeric input", () => {
    const result = validateAmount("abc")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter a valid amount")
  })

  it("fails for amount exceeding maxAmount", () => {
    const result = validateAmount("100", { maxAmount: 50 })
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Amount exceeds maximum")
  })

  it("passes for amount at maxAmount boundary", () => {
    const result = validateAmount("50", { maxAmount: 50 })
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("passes for amount below maxAmount", () => {
    const result = validateAmount("25", { maxAmount: 50 })
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles partial decimal input (trailing dot) as valid incomplete", () => {
    // parseAmount treats "1." as { value: 1, isPartial: true }
    // which is > 0, so it passes
    const result = validateAmount("1.")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles tiny values (high precision)", () => {
    const result = validateAmount("0.0000001")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles large values", () => {
    const result = validateAmount("999999999.9999999")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("respects custom decimals precision", () => {
    // With 2 decimals, 1.555 truncates to 1.55 (> 0, valid)
    const result = validateAmount("1.555", { decimals: 2 })
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validatePrice
// ─────────────────────────────────────────────────────────────────────────────

describe("validatePrice", () => {
  it("passes for valid positive price", () => {
    const result = validatePrice("100.5")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails for empty string", () => {
    const result = validatePrice("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter a price")
  })

  it("fails for zero", () => {
    const result = validatePrice("0")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Price must be greater than zero")
  })

  it("fails for negative value", () => {
    const result = validatePrice("-100")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter a valid price")
  })

  it("fails for non-numeric input", () => {
    const result = validatePrice("market")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Enter a valid price")
  })

  it("handles tiny prices (high precision)", () => {
    const result = validatePrice("0.00001")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles large prices", () => {
    const result = validatePrice("50000.123456")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("respects custom decimals for price precision", () => {
    const result = validatePrice("100.1234567", { decimals: 6 })
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateTick
// ─────────────────────────────────────────────────────────────────────────────

describe("validateTick", () => {
  it("passes when value is exact multiple of tick size", () => {
    const result = validateTick(100, 10)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("passes when value is 1x tick size", () => {
    const result = validateTick(0.01, 0.01)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails when value is not a multiple of tick", () => {
    const result = validateTick(105, 10)
    expect(result.isValid).toBe(false)
    expect(result.error).toMatch(/multiple of/)
  })

  it("handles decimal tick sizes", () => {
    const result = validateTick(1.5, 0.5)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles high-precision tick validation with floating-point tolerance", () => {
    // 100.00001 should be close enough to 100 (tick 0.00001)
    const result = validateTick(100.00001, 0.00001)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("rejects invalid tick configurations", () => {
    const result = validateTick(100, 0)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Invalid tick validation")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateLot
// ─────────────────────────────────────────────────────────────────────────────

describe("validateLot", () => {
  it("passes when value is exact multiple of lot size", () => {
    const result = validateLot(100, 10)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails when value is not a multiple of lot", () => {
    const result = validateLot(105, 10)
    expect(result.isValid).toBe(false)
    expect(result.error).toMatch(/multiple of/)
  })

  it("handles small lot sizes", () => {
    const result = validateLot(1.5, 0.5)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles high-precision lot validation with floating-point tolerance", () => {
    const result = validateLot(1.00001, 0.00001)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("rejects invalid lot configurations", () => {
    const result = validateLot(100, -5)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Invalid lot validation")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateMinNotional
// ─────────────────────────────────────────────────────────────────────────────

describe("validateMinNotional", () => {
  it("passes when value exceeds minimum notional", () => {
    const result = validateMinNotional(1000, 100)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("passes when value equals minimum notional", () => {
    const result = validateMinNotional(100, 100)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails when value is below minimum notional", () => {
    const result = validateMinNotional(50, 100)
    expect(result.isValid).toBe(false)
    expect(result.error).toMatch(/Minimum trade size/)
  })

  it("includes minimum notional amount in error message", () => {
    const result = validateMinNotional(50, 1000)
    expect(result.error).toContain("$1,000")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateBalance
// ─────────────────────────────────────────────────────────────────────────────

describe("validateBalance", () => {
  it("passes when amount is less than balance", () => {
    const result = validateBalance(100, 500)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("passes when amount equals balance", () => {
    const result = validateBalance(500, 500)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("fails when amount exceeds balance", () => {
    const result = validateBalance(600, 500)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Insufficient balance")
  })

  it("fails when balance is undefined", () => {
    const result = validateBalance(100, undefined)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Balance not available")
  })

  it("handles tiny balance amounts", () => {
    const result = validateBalance(0.0000001, 0.00001)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it("handles large balance amounts", () => {
    const result = validateBalance(1000000, 9999999)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })
})
