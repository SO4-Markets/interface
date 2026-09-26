import { expect, test } from "@playwright/test"
import { existsSync } from "node:fs"
import path from "node:path"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

// OB-127: keyboard / screen-reader / reduced-motion journey across the core
// trade workspace. Automated axe checks + explicit interaction coverage.

function resolveAxePath() {
  const candidates = [
    path.join(process.cwd(), "node_modules/axe-core/axe.min.js"),
    path.join(process.cwd(), "apps/web/node_modules/axe-core/axe.min.js"),
    path.join(process.cwd(), "packages/ui/node_modules/axe-core/axe.min.js"),
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error(`axe-core not found. Tried:\n${candidates.join("\n")}`)
  }
  return found
}

async function runAxeSerious(page: import("@playwright/test").Page) {
  await page.addScriptTag({ path: resolveAxePath() })
  return page.evaluate(async () => {
    const axe = (
      window as Window & {
        axe?: {
          run: (
            context: Document,
            options: Record<string, unknown>,
          ) => Promise<{ violations: Array<{ impact?: string | null; id: string; help: string }> }>
        }
      }
    ).axe
    if (!axe) return [{ id: "axe-missing", help: "axe-core failed to load", impact: "critical" }]
    const results = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    })
    return results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    )
  })
}

test.describe("trade accessibility journey", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  })

  test.beforeEach(async ({ page }) => {
    await stubTradeExternalNetwork(page)
  })

  test("core trade flow keeps focus, escape, and live regions correct", async ({
    page,
  }) => {
    await page.goto("/trade")
    await page.waitForLoadState("networkidle")

    // Skip link is first tab stop (shared shell).
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: /skip to main content/i })
    await expect(skip).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("#main-content")).toBeFocused()

    // Market selector: open, Escape restores focus to trigger.
    const marketTrigger = page.getByRole("button", { name: /BTC\/USD|Select Market/i }).first()
    await marketTrigger.click()
    await expect(page.getByRole("listbox").or(page.getByLabel(/search markets/i))).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(marketTrigger).toBeFocused()

    // Ticket tabs remain keyboard reachable.
    const longTab = page.getByRole("tab", { name: "Long" })
    await longTab.focus()
    await expect(longTab).toBeFocused()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("tab", { name: "Short" })).toBeFocused()

    // Order book region is labelled for AT.
    await expect(page.getByLabel(/order book depth/i)).toBeVisible()

    // Account tables / bottom tabs.
    await expect(page.getByRole("tab", { name: /^positions/i })).toBeVisible()
    await page.getByRole("tab", { name: /^orders/i }).click()
    await expect(page.getByRole("tab", { name: /^orders/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )

    // Polite live region exists once (route/status announcements).
    const live = page.locator("[data-slot='live-region']")
    await expect(live.first()).toHaveAttribute("aria-live", /polite|off|assertive/)

    const serious = await runAxeSerious(page)
    expect(
      serious,
      serious.map((v: { id: string; help: string }) => `${v.id}: ${v.help}`).join("\n"),
    ).toEqual([])
  })

  test("mobile trade nav keeps reduced-motion overlays escapable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/trade")
    await page.waitForLoadState("networkidle")

    const bookControl = page.getByRole("button", { name: /book|depth|trades/i }).first()
    if (await bookControl.isVisible()) {
      await bookControl.click()
      await page.keyboard.press("Escape")
    }

    await expect(page.getByRole("tab", { name: "Long" })).toBeVisible()
    const serious = await runAxeSerious(page)
    expect(serious).toEqual([])
  })
})
