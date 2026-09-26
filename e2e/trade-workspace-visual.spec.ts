import { expect, test } from "@playwright/test"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

// OB-128: representative visual fixtures for the season trade workspace across
// desktop / tablet / mobile, themes, and reduced-motion.

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const

const THEMES = ["light", "dark"] as const

for (const theme of THEMES) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`trade workspace ${theme} ${viewportName}`, () => {
      test.use({ viewport, reducedMotion: "reduce" })

      test.beforeEach(async ({ page }) => {
        await stubTradeExternalNetwork(page)
        await page.addInitScript((t) => {
          window.localStorage.setItem("so4-theme", t)
        }, theme)
        await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") })
        await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"))
      })

      test(`idle workspace`, async ({ page }) => {
        await page.goto("/trade")
        await page.waitForLoadState("networkidle")
        await expect(page).toHaveScreenshot(
          `trade-workspace-${theme}-${viewportName}.png`,
          { fullPage: true, animations: "disabled" },
        )
      })

      test(`long ticket selected`, async ({ page }) => {
        await page.goto("/trade")
        await page.waitForLoadState("networkidle")
        await page.getByRole("tab", { name: "Long" }).click()
        await expect(page).toHaveScreenshot(
          `trade-long-${theme}-${viewportName}.png`,
          { fullPage: true, animations: "disabled" },
        )
      })
    })
  }
}
