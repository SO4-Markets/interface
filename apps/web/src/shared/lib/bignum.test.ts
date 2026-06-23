import { describe, expect, it } from "vitest"

import {
  formatSorobanAmount,
  fromSorobanAmount,
  toSorobanAmount,
} from "./bignum"

describe("Soroban amount conversions", () => {
  it("converts XLM amounts with 7 decimals", () => {
    const raw = toSorobanAmount("12.3456789", 7)

    expect(raw).toBe(123456789n)
    expect(fromSorobanAmount(raw, 7)).toBe(12.3456789)
    expect(formatSorobanAmount(raw, 7)).toBe("12.3456789")
  })

  it("converts USDC amounts with 6 decimals", () => {
    const raw = toSorobanAmount("2500.000001", 6)

    expect(raw).toBe(2500000001n)
    expect(fromSorobanAmount(raw, 6)).toBe(2500.000001)
    expect(formatSorobanAmount(raw, 6)).toBe("2500.000001")
  })

  it("converts BTC amounts with 8 decimals", () => {
    const raw = toSorobanAmount("0.12345678", 8)

    expect(raw).toBe(12345678n)
    expect(fromSorobanAmount(raw, 8)).toBe(0.12345678)
    expect(formatSorobanAmount(raw, 8)).toBe("0.12345678")
  })

  it("pads fractional digits without floating-point rounding", () => {
    expect(toSorobanAmount("0.1", 7)).toBe(1000000n)
    expect(toSorobanAmount("0.2", 7)).toBe(2000000n)
    expect(toSorobanAmount("0.3", 7)).toBe(3000000n)
    expect(toSorobanAmount(0.0000001, 7)).toBe(1n)
  })

  it("rejects amounts that cannot fit the requested decimal scale", () => {
    expect(() => toSorobanAmount("1.12345678", 7)).toThrow(/more than 7/)
  })

  it("formats with optional bigint-based precision rounding", () => {
    expect(formatSorobanAmount(123456789n, 7, 2)).toBe("12.35")
    expect(formatSorobanAmount(123400000n, 7, 4)).toBe("12.34")
  })

  it("handles negative raw and display amounts", () => {
    expect(toSorobanAmount("-1.5", 7)).toBe(-15000000n)
    expect(formatSorobanAmount(-15000000n, 7)).toBe("-1.5")
  })
})
