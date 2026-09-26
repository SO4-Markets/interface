import { describe, expect, test } from "bun:test"

import { isKebabCase } from "../src/lib/content"
import { validateFrontmatter } from "../src/lib/frontmatter"

describe("content loader — kebab-case validation", () => {
  test("isKebabCase accepts valid names", () => {
    expect(isKebabCase("introduction")).toBe(true)
    expect(isKebabCase("my-page")).toBe(true)
    expect(isKebabCase("page-1")).toBe(true)
    expect(isKebabCase("a-b-c")).toBe(true)
  })

  test("generated page basenames remain valid after removing their suffix", () => {
    expect(isKebabCase("tokens.generated".replace(/\.generated$/, ""))).toBe(
      true
    )
  })

  test("isKebabCase rejects non-kebab-case names", () => {
    expect(isKebabCase("My Page")).toBe(false)
    expect(isKebabCase("myPage")).toBe(false)
    expect(isKebabCase("MY-PAGE")).toBe(false)
    expect(isKebabCase("my_page")).toBe(false)
    expect(isKebabCase("page_name_1")).toBe(false)
    expect(isKebabCase("page.name")).toBe(false)
    expect(isKebabCase("-leading-dash")).toBe(false)
    expect(isKebabCase("trailing-dash-")).toBe(false)
  })
})

describe("content loader — draft exclusion & frontmatter validation", () => {
  test("draft status is accepted by frontmatter schema", () => {
    const fm = validateFrontmatter("test.mdx", {
      title: "Alpha",
      description:
        "A sufficiently descriptive alpha page for content loader testing.",
      updated: "2026-08-24",
      status: "draft",
    })
    expect(fm.status).toBe("draft")
  })

  test("valid non-draft page is accepted", () => {
    const fm = validateFrontmatter("test.mdx", {
      title: "Stable page",
      description:
        "A sufficiently descriptive stable page for content loader validation testing.",
      updated: "2026-08-24",
      status: "stable",
    })
    expect(fm.status).toBe("stable")
  })

  test("rejects malformed frontmatter objects", () => {
    expect(() => validateFrontmatter("bad-title.mdx", {
      title: "",
      description: "A valid description that satisfies the min length threshold.",
      updated: "2026-08-24",
      status: "stable",
    })).toThrow("bad-title.mdx")

    expect(() => validateFrontmatter("bad-date.mdx", {
      title: "Valid title",
      description: "A valid description that satisfies the min length threshold.",
      updated: "24-08-2026",
      status: "stable",
    })).toThrow("bad-date.mdx")
  })
})
