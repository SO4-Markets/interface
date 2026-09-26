import { describe, expect, test } from "vitest"
import {
  coarseDay,
  feedbackStorageKey,
  isValidPath,
  isValidVerdict,
  parseFeedbackSubmission,
  redactSensitive,
} from "./feedback"

describe("redactSensitive", () => {
  test("redacts a Stellar account strkey", () => {
    const text = `My account is GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF, help`
    expect(redactSensitive(text)).not.toContain("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
    expect(redactSensitive(text)).toContain("[redacted]")
  })

  test("redacts a Stellar secret seed", () => {
    const text = `SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF leaked`
    expect(redactSensitive(text)).not.toContain("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
  })

  test("redacts an email address", () => {
    expect(redactSensitive("contact me at trader@example.com please")).toBe(
      "contact me at [redacted] please",
    )
  })

  test("redacts a 32-byte hex string", () => {
    const hex = "a".repeat(64)
    expect(redactSensitive(`key: ${hex}`)).toBe("key: [redacted]")
  })

  test("redacts an EVM-style address", () => {
    const addr = `0x${"1".repeat(40)}`
    expect(redactSensitive(`wallet ${addr}`)).toBe("wallet [redacted]")
  })

  test("leaves ordinary text untouched", () => {
    const text = "The liquidation price tooltip was confusing on mobile."
    expect(redactSensitive(text)).toBe(text)
  })
})

describe("isValidPath", () => {
  test("accepts a lowercase kebab-case route", () => {
    expect(isValidPath("/concepts/funding-and-fees")).toBe(true)
  })

  test("rejects a non-string", () => {
    expect(isValidPath(42)).toBe(false)
  })

  test("rejects a path without a leading slash", () => {
    expect(isValidPath("concepts/risk")).toBe(false)
  })

  test("rejects uppercase characters", () => {
    expect(isValidPath("/Concepts/Risk")).toBe(false)
  })

  test("rejects an overly long path", () => {
    expect(isValidPath(`/${"a".repeat(201)}`)).toBe(false)
  })
})

describe("isValidVerdict", () => {
  test("accepts yes and no", () => {
    expect(isValidVerdict("yes")).toBe(true)
    expect(isValidVerdict("no")).toBe(true)
  })

  test("rejects anything else", () => {
    expect(isValidVerdict("maybe")).toBe(false)
    expect(isValidVerdict(1)).toBe(false)
    expect(isValidVerdict(undefined)).toBe(false)
  })
})

describe("coarseDay", () => {
  test("returns only the date portion, in UTC", () => {
    expect(coarseDay(new Date("2026-08-31T23:59:59.999Z"))).toBe("2026-08-31")
  })
})

describe("feedbackStorageKey", () => {
  test("maps a nested path to a flat key", () => {
    expect(feedbackStorageKey("/concepts/funding-and-fees")).toBe(
      "concepts-funding-and-fees",
    )
  })

  test("maps the docs home to a stable key", () => {
    expect(feedbackStorageKey("/")).toBe("index")
  })
})

describe("parseFeedbackSubmission", () => {
  const now = new Date("2026-08-31T12:00:00.000Z")

  test("accepts a minimal valid submission", () => {
    const record = parseFeedbackSubmission(
      { path: "/concepts/risk", verdict: "yes" },
      now,
    )
    expect(record).toEqual({
      path: "/concepts/risk",
      verdict: "yes",
      comment: null,
      day: "2026-08-31",
    })
  })

  test("trims and redacts an optional comment", () => {
    const record = parseFeedbackSubmission(
      {
        path: "/concepts/risk",
        verdict: "no",
        comment: "  reach me at trader@example.com  ",
      },
      now,
    )
    expect(record?.comment).toBe("reach me at [redacted]")
  })

  test("caps an overly long comment", () => {
    const record = parseFeedbackSubmission(
      { path: "/concepts/risk", verdict: "yes", comment: "x".repeat(1000) },
      now,
    )
    expect(record?.comment).toHaveLength(500)
  })

  test("stores an empty or whitespace-only comment as null", () => {
    const record = parseFeedbackSubmission(
      { path: "/concepts/risk", verdict: "yes", comment: "   " },
      now,
    )
    expect(record?.comment).toBeNull()
  })

  test("rejects a missing path", () => {
    expect(parseFeedbackSubmission({ verdict: "yes" }, now)).toBeNull()
  })

  test("rejects an invalid verdict", () => {
    expect(
      parseFeedbackSubmission({ path: "/concepts/risk", verdict: "sure" }, now),
    ).toBeNull()
  })

  test("rejects a non-string comment", () => {
    expect(
      parseFeedbackSubmission(
        { path: "/concepts/risk", verdict: "yes", comment: 123 },
        now,
      ),
    ).toBeNull()
  })

  test("rejects a null body", () => {
    expect(parseFeedbackSubmission(null, now)).toBeNull()
  })

  test("never includes an identifier, cookie, or IP field", () => {
    const record = parseFeedbackSubmission(
      { path: "/concepts/risk", verdict: "yes" },
      now,
    )
    expect(Object.keys(record ?? {}).sort()).toEqual([
      "comment",
      "day",
      "path",
      "verdict",
    ])
  })
})
