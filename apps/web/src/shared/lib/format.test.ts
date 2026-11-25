import { describe, expect, it } from "vitest"
import {
  formatAddress,
  formatCompact,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMarketAmount,
  formatMarketPrice,
  formatNumber,
  formatPct,
  formatPercent,
  formatRelativeTime,
  formatSmall,
  formatTime,
  formatToken,
  formatTxHash,
  formatUsd,
} from "./format"

// ─── Shared fallback ─────────────────────────────────────────────────────────

describe("shared fallback for invalid values", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ] as const)("returns — for %s", (_label, value) => {
    expect(formatUsd(value)).toBe("—")
    expect(formatToken(value, "USDC")).toBe("—")
    expect(formatPct(value)).toBe("—")
    expect(formatCompact(value)).toBe("—")
    expect(formatSmall(value)).toBe("—")
  })

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["invalid date string", "not-a-date"],
  ] as const)("returns — for %s date input", (_label, value) => {
    expect(formatDate(value as unknown as Date)).toBe("—")
    expect(formatTime(value as unknown as Date)).toBe("—")
    expect(formatDateTime(value as unknown as Date)).toBe("—")
    expect(formatRelativeTime(value as unknown as Date)).toBe("—")
  })
})

// ─── Negative zero ────────────────────────────────────────────────────────────

describe("negative zero normalization", () => {
  it("formatUsd renders -0 as $0.00", () => {
    expect(formatUsd(-0)).toBe("$0.00")
  })

  it("formatToken renders -0 as 0", () => {
    expect(formatToken(-0, "USDC")).toBe("0 USDC")
  })

  it("formatPct renders -0 as +0.00%", () => {
    expect(formatPct(-0)).toBe("+0.00%")
  })

  it("formatCompact renders -0 as 0", () => {
    expect(formatCompact(-0)).toBe("0")
  })

  it("formatSmall renders -0 as 0", () => {
    expect(formatSmall(-0)).toBe("0")
  })
})

// ─── formatUsd ───────────────────────────────────────────────────────────────

describe("formatUsd", () => {
  it("formats a simple dollar amount", () => {
    expect(formatUsd(12345.678)).toBe("$12,345.68")
  })

  it("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00")
  })

  it("formats negative values", () => {
    expect(formatUsd(-500)).toBe("-$500.00")
  })

  it("respects custom decimals", () => {
    expect(formatUsd(1.5, { decimals: 4 })).toBe("$1.5000")
  })

  it("renders compact notation for large values", () => {
    expect(formatUsd(1_200_000, { compact: true })).toBe("$1.2M")
    expect(formatUsd(2_500_000_000, { compact: true })).toBe("$2.5B")
  })

  it("accepts a custom locale (de-DE uses . for grouping, , for decimals)", () => {
    expect(formatUsd(12345.67, { locale: "de-DE" })).toBe("12.345,67\u00a0$")
  })

  it("accepts a custom currency code", () => {
    expect(formatUsd(100, { currency: "EUR", locale: "de-DE" })).toBe("100,00\u00a0€")
  })
})

// ─── formatCompact ───────────────────────────────────────────────────────────

describe("formatCompact", () => {
  it("formats thousands as K", () => {
    expect(formatCompact(1_500)).toBe("1.5K")
  })

  it("formats millions as M", () => {
    expect(formatCompact(2_300_000)).toBe("2.3M")
  })

  it("formats billions as B", () => {
    expect(formatCompact(4_500_000_000)).toBe("4.5B")
  })

  it("returns plain number for values under 1000", () => {
    expect(formatCompact(999)).toBe("999")
    expect(formatCompact(12.5)).toBe("12.5")
  })

  it("respects decimal precision", () => {
    expect(formatCompact(1_234_567, { decimals: 2 })).toBe("1.23M")
  })

  it("uses toFixed for compact B/M/K (locale-independent)", () => {
    expect(formatCompact(1_500, { locale: "de-DE" })).toBe("1.5K")
  })
})

// ─── formatToken ─────────────────────────────────────────────────────────────

describe("formatToken", () => {
  it("places the token symbol after the formatted amount", () => {
    expect(formatToken(1.5, "TUSDC")).toBe("1.5 TUSDC")
    expect(formatToken(0.00432, "TWBTC")).toBe("0.0043 TWBTC")
  })

  it("formats zero balances", () => {
    expect(formatToken(0, "TXLM")).toBe("0 TXLM")
    expect(formatToken(0, "TUSDC", { decimals: 2 })).toBe("0 TUSDC")
    expect(formatToken(0, "TUSDC", { decimals: 2, minDecimals: 2 })).toBe("0.00 TUSDC")
  })

  it("formats large balances with grouping separators", () => {
    expect(formatToken(1_234_567.8912, "USDC", { decimals: 4 })).toBe("1,234,567.8912 USDC")
  })

  it("formats with de-DE locale", () => {
    expect(formatToken(1234.5, "BTC", { locale: "de-DE" })).toBe("1.234,5 BTC")
  })

  it("pads to minimum decimals", () => {
    expect(formatToken(100, "esSO4", { minDecimals: 2 })).toBe("100.00 esSO4")
  })
})

// ─── formatSmall ──────────────────────────────────────────────────────────────

describe("formatSmall", () => {
  it("renders normal values as-is", () => {
    expect(formatSmall(1.5)).toBe("1.5")
    expect(formatSmall(0.01)).toBe("0.01")
  })

  it("renders less-than for values below threshold", () => {
    expect(formatSmall(0.00005)).toBe("<0.0001")
    expect(formatSmall(0.00001)).toBe("<0.0001")
  })

  it("renders zero as 0", () => {
    expect(formatSmall(0)).toBe("0")
  })

  it("respects custom threshold", () => {
    expect(formatSmall(0.001, { threshold: 0.01 })).toBe("<0.0100")
    expect(formatSmall(0.005, { threshold: 0.01 })).toBe("<0.0100")
  })

  it("shows values at or above threshold", () => {
    expect(formatSmall(0.0001)).toBe("0.0001")
    expect(formatSmall(0.01)).toBe("0.01")
  })

  it("formats with de-DE locale", () => {
    expect(formatSmall(0.00005, { locale: "de-DE" })).toBe("<0,0001")
  })
})

// ─── formatPct ───────────────────────────────────────────────────────────────

describe("formatPct", () => {
  it("formats positive value with + sign", () => {
    expect(formatPct(1.23)).toBe("+1.23%")
  })

  it("formats negative value with - sign", () => {
    expect(formatPct(-0.45)).toBe("-0.45%")
  })

  it("formats zero with + sign by default", () => {
    expect(formatPct(0)).toBe("+0.00%")
  })

  it("hides sign when sign option is false", () => {
    expect(formatPct(1.23, { sign: false })).toBe("1.23%")
    expect(formatPct(-0.45, { sign: false })).toBe("-0.45%")
  })

  it("respects custom decimals", () => {
    expect(formatPct(1.2345, { decimals: 3 })).toBe("+1.235%")
  })
})

// ─── formatAddress ────────────────────────────────────────────────────────────

describe("formatAddress", () => {
  it("truncates a long Stellar address", () => {
    expect(formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890WXYZ")).toBe("GABCDE…WXYZ")
  })

  it("returns the input unchanged for short strings", () => {
    expect(formatAddress("short")).toBe("short")
  })

  it("returns fallback for empty string", () => {
    expect(formatAddress("")).toBe("—")
  })
})

// ─── formatTxHash ────────────────────────────────────────────────────────────

describe("formatTxHash", () => {
  it("truncates a transaction hash", () => {
    expect(formatTxHash("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")).toBe("a1b2c3d4…o5p6")
  })

  it("returns fallback for empty string", () => {
    expect(formatTxHash("")).toBe("—")
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-07-29")
    expect(result).toMatch(/Jul.*29.*2026/)
  })

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-07-29"))
    expect(result).toMatch(/Jul.*29.*2026/)
  })

  it("formats a timestamp", () => {
    const ts = new Date("2026-07-29").getTime()
    const result = formatDate(ts)
    expect(result).toMatch(/Jul.*29.*2026/)
  })

  it("respects locale (de-DE uses day.month.year)", () => {
    expect(formatDate("2026-07-29", { locale: "de-DE" })).toBe("29.7.2026")
  })

  it("respects custom month format", () => {
    expect(formatDate("2026-07-29", { month: "long" })).toContain("July")
  })
})

// ─── formatTime ───────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats a time", () => {
    const result = formatTime("2026-07-29T14:30:00Z")
    expect(result).toBeTruthy()
  })

  it("shows timezone name when requested", () => {
    const result = formatTime("2026-07-29T14:30:00Z", { timeZone: "UTC", timeZoneName: "short" })
    expect(result).toContain("UTC")
  })

  it("includes seconds when requested", () => {
    const result = formatTime("2026-07-29T14:30:15Z", { second: "2-digit", timeZone: "UTC" })
    expect(result).toContain("15")
  })
})

// ─── formatDateTime ──────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("combines date and time", () => {
    const result = formatDateTime("2026-07-29T14:30:00Z")
    expect(result).toBeTruthy()
  })

  it("respects locale", () => {
    const result = formatDateTime("2026-07-29T14:30:00Z", { locale: "de-DE", timeZone: "UTC" })
    expect(result).toContain("29")
    expect(result).toContain("7")
    expect(result).toContain("2026")
  })
})

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("formats future dates", () => {
    const future = Date.now() + 7200_000
    const result = formatRelativeTime(new Date(future))
    expect(result).toContain("2")
  })

  it("formats past dates", () => {
    const past = Date.now() - 7200_000
    const result = formatRelativeTime(new Date(past))
    expect(result).toContain("2")
  })

  it("formats recent dates as 'now'", () => {
    const result = formatRelativeTime(new Date())
    expect(result).toBeTruthy()
  })

  it("respects locale (de-DE)", () => {
    const past = Date.now() - 3600_000
    const result = formatRelativeTime(new Date(past), { locale: "de-DE" })
    expect(result).toBeTruthy()
  })
})

// ─── Large values ────────────────────────────────────────────────────────────

describe("large values with grouping separators", () => {
  it("formatUsd groups thousands", () => {
    expect(formatUsd(1_234_567.89)).toBe("$1,234,567.89")
  })

  it("formatToken groups thousands", () => {
    expect(formatToken(9_876_543.21, "WBTC", { decimals: 2 })).toBe("9,876,543.21 WBTC")
  })

  it("formatUsd groups with de-DE locale", () => {
    expect(formatUsd(1_234_567.89, { locale: "de-DE" })).toBe("1.234.567,89\u00a0$")
  })

  it("formats trillions with compact formatting", () => {
    expect(formatCompact(2_500_000_000_000)).toBe("2500.0B")
  })
})

// ─── formatMarketPrice & formatMarketAmount ───────────────────────────────────

describe("formatMarketPrice", () => {
  it("formats market price with default 2 decimals and comma grouping", () => {
    expect(formatMarketPrice(1234.5)).toBe("1,234.50")
    expect(formatMarketPrice(67890.1234)).toBe("67,890.12")
  })

  it("respects custom decimals number shorthand", () => {
    expect(formatMarketPrice(67890.12345, 4)).toBe("67,890.1235")
  })

  it("derives decimals from tickSize option", () => {
    expect(formatMarketPrice(123.4567, { tickSize: 0.001 })).toBe("123.457")
    expect(formatMarketPrice(123.4567, { tickSize: 0.01 })).toBe("123.46")
  })

  it("supports custom locale (de-DE)", () => {
    expect(formatMarketPrice(1234.56, { locale: "de-DE" })).toBe("1.234,56")
  })

  it("handles zero and negative zero", () => {
    expect(formatMarketPrice(0)).toBe("0.00")
    expect(formatMarketPrice(-0)).toBe("0.00")
  })

  it("handles invalid or missing values", () => {
    expect(formatMarketPrice(null)).toBe("—")
    expect(formatMarketPrice(undefined)).toBe("—")
    expect(formatMarketPrice(Number.NaN)).toBe("—")
  })
})

describe("formatMarketAmount", () => {
  it("formats base amounts with default 4 decimals", () => {
    expect(formatMarketAmount(12.345678)).toBe("12.3457")
  })

  it("respects number shorthand for decimals", () => {
    expect(formatMarketAmount(12.345678, 2)).toBe("12.35")
  })

  it("supports minDecimals padding", () => {
    expect(formatMarketAmount(5, { minDecimals: 2 })).toBe("5.00")
  })

  it("supports custom locale (de-DE)", () => {
    expect(formatMarketAmount(1234.5, { locale: "de-DE", minDecimals: 2 })).toBe("1.234,50")
  })

  it("handles zero and fallback", () => {
    expect(formatMarketAmount(0)).toBe("0")
    expect(formatMarketAmount(null)).toBe("—")
  })
})

// ─── formatNumber, formatCurrency, formatPercent ──────────────────────────────

describe("shared formatters aliases and precision handling", () => {
  it("formatCurrency aliases formatUsd", () => {
    expect(formatCurrency(1234.5)).toBe(formatUsd(1234.5))
    expect(formatCurrency(null)).toBe("—")
  })

  it("formatPercent aliases formatPct with locale support", () => {
    expect(formatPercent(5.25)).toBe("+5.25%")
    expect(formatPercent(5.25, { locale: "de-DE" })).toBe("+5,25%")
  })

  it("formatNumber formats generic numbers with grouping and decimals", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89")
    expect(formatNumber(1234.5, { minDecimals: 2 })).toBe("1,234.50")
    expect(formatNumber(1234.5678, { decimals: 2 })).toBe("1,234.57")
    expect(formatNumber(1234.56, { locale: "de-DE" })).toBe("1.234,56")
  })

  it("handles tiny and sub-cent values across formatters", () => {
    expect(formatSmall(0.00001)).toBe("<0.0001")
    expect(formatMarketPrice(0.00012, { decimals: 5 })).toBe("0.00012")
    expect(formatPct(0.001, { decimals: 3 })).toBe("+0.001%")
  })

  it("handles rounding edge cases consistently", () => {
    expect(formatUsd(1.005)).toBe("$1.01")
    expect(formatPct(2.455, { decimals: 2 })).toBe("+2.46%")
    expect(formatMarketPrice(99.994, 2)).toBe("99.99")
    expect(formatMarketPrice(99.995, 2)).toBe("100.00")
  })
})