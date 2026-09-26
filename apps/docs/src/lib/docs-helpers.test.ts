import { describe, expect, it } from "vitest"
import {
  getGitHubEditUrl,
  formatRelativeTime,
  isPageStale,
} from "./docs-helpers"

describe("DX-045: docs-helpers", () => {
  describe("getGitHubEditUrl", () => {
    it("generates correct GitHub edit URL for route strings", () => {
      expect(getGitHubEditUrl("/get-started/quickstart")).toBe(
        "https://github.com/SO4-Markets/interface/edit/main/apps/docs/content/get-started/quickstart.mdx"
      )
      expect(getGitHubEditUrl("/")).toBe(
        "https://github.com/SO4-Markets/interface/edit/main/apps/docs/content/index.mdx"
      )
    })

    it("accepts custom branch", () => {
      expect(
        getGitHubEditUrl("/concepts/liquidation", "feat/my-branch")
      ).toBe(
        "https://github.com/SO4-Markets/interface/edit/feat/my-branch/apps/docs/content/concepts/liquidation.mdx"
      )
    })
  })

  describe("formatRelativeTime", () => {
    const fixedNow = new Date("2026-08-30T12:00:00Z")

    it("formats today and yesterday", () => {
      expect(formatRelativeTime("2026-08-30", fixedNow)).toBe("today")
      expect(formatRelativeTime("2026-08-29", fixedNow)).toBe("yesterday")
    })

    it("formats relative days, months, and years", () => {
      expect(formatRelativeTime("2026-08-20", fixedNow)).toBe("10 days ago")
      expect(formatRelativeTime("2026-07-15", fixedNow)).toBe("1 month ago")
      expect(formatRelativeTime("2026-02-15", fixedNow)).toBe("6 months ago")
      expect(formatRelativeTime("2025-08-15", fixedNow)).toBe("1 year ago")
    })

    it("returns raw string if invalid date", () => {
      expect(formatRelativeTime("invalid-date", fixedNow)).toBe("invalid-date")
    })
  })

  describe("isPageStale", () => {
    const fixedNow = new Date("2026-08-30T12:00:00Z")

    it("identifies fresh pages <= 180 days", () => {
      expect(isPageStale("2026-08-20", fixedNow)).toBe(false)
      expect(isPageStale("2026-03-10", fixedNow)).toBe(false)
    })

    it("identifies stale pages > 180 days", () => {
      expect(isPageStale("2026-01-01", fixedNow)).toBe(true)
      expect(isPageStale("2025-08-01", fixedNow)).toBe(true)
    })
  })
})
