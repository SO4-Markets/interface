import { describe, expect, test } from "bun:test"
import { lintMarkdownContent } from "./lint-prose"

describe("SO4 prose linter (DX-053)", () => {
  test("flags prohibited weak words as correctness errors", () => {
    const markdown = "You simply connect your wallet and it is obviously easy to trade."
    const result = lintMarkdownContent("test.md", markdown)

    expect(result.errors.length).toBeGreaterThanOrEqual(3)
    const rules = result.errors.map((e) => e.rule)
    expect(rules).toContain("banned-words")
  })

  test("flags exclamation marks as correctness errors", () => {
    const markdown = "Welcome to SO4 Markets!"
    const result = lintMarkdownContent("test.md", markdown)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].rule).toBe("no-exclamation-mark")
  })

  test("enforces product and protocol capitalization", () => {
    const markdown = "Deploy your contract to stellar using soroban and freighter."
    const result = lintMarkdownContent("test.md", markdown)

    expect(result.errors.length).toBe(3)
    const messages = result.errors.map((e) => e.message)
    expect(messages.some((m) => m.includes("Stellar"))).toBe(true)
    expect(messages.some((m) => m.includes("Soroban"))).toBe(true)
    expect(messages.some((m) => m.includes("Freighter"))).toBe(true)
  })

  test("terminates on a hyphenated term with only a case-insensitive flag (regression: infinite loop)", () => {
    // DX-050/061/072/075: order-vault, exchange-router, synthetics-reader,
    // and data-store previously used /i without /g. A non-global regex's
    // .exec() never advances past its first match, so `while (exec() !==
    // null)` never terminated on any line containing one of these terms —
    // hanging the linter (and the docs build, which shells out to it)
    // whenever content mentioned any of the four, which existing reference
    // pages already do throughout. This test just needs to return.
    const markdown = "See the data-store, order-vault, exchange-router, and synthetics-reader clients."
    const result = lintMarkdownContent("test.md", markdown)
    expect(result.errors.length).toBe(4)
  })

  test("does not flag a route path or URL for capitalization (regression: false positive)", () => {
    // A link like [/reference/synthetics-reader](/reference/synthetics-reader)
    // or a bare `data-store.ts` file path is required to be lowercase-kebab;
    // it is not a prose mention of the SyntheticsReader contract.
    const markdown = [
      "See [/reference/synthetics-reader](/reference/synthetics-reader) and [/reference/exchange-router](/reference/exchange-router).",
      "The client lives in `apps/web/src/features/trade/lib/data-store.ts`.",
      "Compare against [Stellar Expert](https://stellar.expert) for the order-vault contract.",
    ].join("\n")
    const result = lintMarkdownContent("test.md", markdown)
    const capsErrors = result.errors.filter((e) => e.rule === "correct-capitalization")
    // "order-vault" on the third line sits outside any code span or link,
    // so it is still a genuine violation — masking must not over-exempt.
    expect(capsErrors).toHaveLength(1)
    expect(capsErrors[0].message).toContain("order-vault")
  })

  test("flags sentence length > 30 words as style warning", () => {
    const longSentence =
      "This is an exceptionally long sentence designed specifically to test the prose linter sentence length threshold rule which ensures that every technical sentence remains clear concise and readable for traders and integrators reading our documentation."
    const result = lintMarkdownContent("test.md", longSentence)

    expect(result.warnings.some((w) => w.rule === "sentence-length")).toBe(true)
  })

  test("flags passive voice constructions as style warning", () => {
    const passiveText = "The collateral is managed by the order vault contract."
    const result = lintMarkdownContent("test.md", passiveText)

    expect(result.warnings.some((w) => w.rule === "prefer-active-voice")).toBe(true)
  })

  test("passes clean compliant markdown without errors", () => {
    const cleanMarkdown = `---
title: Understanding Perpetual Futures
description: Perpetual futures allow traders to gain exposure to market price movements without holding underlying assets.
updated: 2026-08-28
status: stable
---

# Perpetual Futures

Perpetual futures track spot index prices through periodic funding payments.`

    const result = lintMarkdownContent("clean.mdx", cleanMarkdown)
    expect(result.errors).toHaveLength(0)
  })
})
