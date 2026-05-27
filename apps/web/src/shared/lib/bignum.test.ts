import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatSorobanAmount,
  fromSorobanAmount,
  toSorobanAmount,
} from "./bignum"

describe("Soroban amount conversions", () => {
  it("converts XLM amounts with 7 decimals", () => {
    const raw = toSorobanAmount("12.3456789", 7)

    assert.equal(raw, 123456789n)
    assert.equal(fromSorobanAmount(raw, 7), 12.3456789)
    assert.equal(formatSorobanAmount(raw, 7), "12.3456789")
  })

  it("converts USDC amounts with 6 decimals", () => {
    const raw = toSorobanAmount("2500.000001", 6)

    assert.equal(raw, 2500000001n)
    assert.equal(fromSorobanAmount(raw, 6), 2500.000001)
    assert.equal(formatSorobanAmount(raw, 6), "2500.000001")
  })

  it("converts BTC amounts with 8 decimals", () => {
    const raw = toSorobanAmount("0.12345678", 8)

    assert.equal(raw, 12345678n)
    assert.equal(fromSorobanAmount(raw, 8), 0.12345678)
    assert.equal(formatSorobanAmount(raw, 8), "0.12345678")
  })

  it("pads fractional digits without floating-point rounding", () => {
    assert.equal(toSorobanAmount("0.1", 7), 1000000n)
    assert.equal(toSorobanAmount("0.2", 7), 2000000n)
    assert.equal(toSorobanAmount("0.3", 7), 3000000n)
    assert.equal(toSorobanAmount(0.0000001, 7), 1n)
  })

  it("rejects amounts that cannot fit the requested decimal scale", () => {
    assert.throws(() => toSorobanAmount("1.12345678", 7), /more than 7/)
  })

  it("formats with optional bigint-based precision rounding", () => {
    assert.equal(formatSorobanAmount(123456789n, 7, 2), "12.35")
    assert.equal(formatSorobanAmount(123400000n, 7, 4), "12.34")
  })

  it("handles negative raw and display amounts", () => {
    assert.equal(toSorobanAmount("-1.5", 7), -15000000n)
    assert.equal(formatSorobanAmount(-15000000n, 7), "-1.5")
  })
})
