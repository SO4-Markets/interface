import { describe, expect, it } from "vitest"
import { xdr } from "@stellar/stellar-sdk/minimal"
import { i128ToScVal } from "../scval"
import fixture from "./i128-scval.json"

describe("i128ToScVal fixture decoder baseline", () => {
  it("encodes the captured fixture value to the expected ScVal shape", () => {
    const input = BigInt(fixture.input)
    const scVal = i128ToScVal(input)

    expect(scVal.switch().name).toBe(fixture.expected.type)

    const parts = scVal.i128()
    expect(parts.lo().toString()).toBe(fixture.expected.lo)
    expect(parts.hi().toString()).toBe(fixture.expected.hi)
  })

  it("round-trips via XDR base64", () => {
    const input = BigInt(fixture.input)
    const scVal = i128ToScVal(input)

    const encoded = scVal.toXDR("base64")
    const decoded = xdr.ScVal.fromXDR(encoded, "base64")

    expect(decoded.switch().name).toBe(fixture.expected.type)
    expect(decoded.i128().lo().toString()).toBe(fixture.expected.lo)
    expect(decoded.i128().hi().toString()).toBe(fixture.expected.hi)
  })

  it("encodes negative i128 values with correct hi bits", () => {
    const negativeOne = i128ToScVal(-1n)
    const parts = negativeOne.i128()
    expect(parts.hi().toString()).toBe("-1")
    expect(parts.lo().toString()).toBe("18446744073709551615")
  })
})

describe("i128ToScVal positive value fixtures", () => {
  // Case: 0n
  // For 0n, both high and low 64-bit parts are 0.
  it("correctly encodes 0n", () => {
    const scVal = i128ToScVal(0n)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("0")
    expect(parts.lo().toString()).toBe("0")
  })

  // Case: 1n
  // For 1n, the high 64-bit part is 0 and the low part is 1.
  it("correctly encodes 1n", () => {
    const scVal = i128ToScVal(1n)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("0")
    expect(parts.lo().toString()).toBe("1")
  })

  // Case: 10n ** 7n (10000000n)
  // For 10000000n, the high 64-bit part is 0 and the low part is 10000000.
  it("correctly encodes 10n ** 7n", () => {
    const scVal = i128ToScVal(10n ** 7n)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("0")
    expect(parts.lo().toString()).toBe("10000000")
  })

  // Case: Value above u64 (e.g. 2^64 + 1)
  // 2^64 + 1 = 18446744073709551617n.
  // The low 64-bit part (18446744073709551617n & 0xFFFFFFFFFFFFFFFFn) is 1.
  // The high 64-bit part (18446744073709551617n >> 64n) is 1.
  it("correctly encodes values above u64", () => {
    const valueAboveU64 = (2n ** 64n) + 1n
    const scVal = i128ToScVal(valueAboveU64)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("1")
    expect(parts.lo().toString()).toBe("1")
  })
})

describe("i128ToScVal negative value fixtures", () => {
  // Case: -1n
  // -1n in two's-complement 128-bit has all bits set to 1.
  // The low 64-bit part is 0xFFFFFFFFFFFFFFFFn (18446744073709551615).
  // The high 64-bit part is -1n.
  it("correctly encodes -1n", () => {
    const scVal = i128ToScVal(-1n)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("-1")
    expect(parts.lo().toString()).toBe("18446744073709551615")
  })

  // Case: -10n ** 7n (-10000000n)
  // The high 64-bit part (-10000000n >> 64n) is -1.
  // The low 64-bit part (-10000000n & 0xFFFFFFFFFFFFFFFFn) is 2^64 - 10000000 = 18446744073699551616.
  it("correctly encodes -10n ** 7n", () => {
    const scVal = i128ToScVal(-(10n ** 7n))
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("-1")
    expect(parts.lo().toString()).toBe("18446744073699551616")
  })

  // Case: Value below -u64 (e.g. -(2^64) - 1)
  // -(2^64) - 1 = -18446744073709551617n.
  // The high 64-bit part (-18446744073709551617n >> 64n) is -2.
  // The low 64-bit part (-18446744073709551617n & 0xFFFFFFFFFFFFFFFFn) is 2^64 - 1 = 18446744073709551615.
  it("correctly encodes values below -u64", () => {
    const valueBelowNegU64 = -(2n ** 64n) - 1n
    const scVal = i128ToScVal(valueBelowNegU64)
    expect(scVal.switch().name).toBe("scvI128")
    const parts = scVal.i128()
    expect(parts.hi().toString()).toBe("-2")
    expect(parts.lo().toString()).toBe("18446744073709551615")
  })
})

