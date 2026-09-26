import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

// DX-057: Visual regression coverage for the documentation app and chrome.
//
// Covers:
// - Layout shell (header, sidebar, TOC, content area, and pager navigation)
// - Kitchen-sink fixture exercising all custom MDX components (DX-034 to DX-038)
// - Sidebar navigation and active section indicators
// - On-page Table of Contents (TOC) with scroll-spy anchors
// - Search dialog in open state with query results
// - 404 error page for unmapped documentation paths
//
// Themes: light | dark
// Viewports: desktop (1280×800) | mobile (390×844)
//
// Stabilization strategy:
// - Theme is injected via addInitScript before page evaluation to prevent theme flashing.
// - System clock is installed and frozen using page.clock so timestamps and relative dates never drift.
// - Third-party network requests are intercepted and stubbed.
// - CSS animations and transitions are frozen via animations: "disabled" and reducedMotion: "reduce".
//
// Updating baselines:
//   bun run test:e2e -- docs-visual --update-snapshots
// and review the resulting snapshots in your pull request.

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const

const THEMES = ["light", "dark"] as const

const STATES = [
  { name: "shell", path: "/" },
  { name: "kitchen-sink", path: "/fixture/kitchen-sink" },
  { name: "sidebar", path: "/developers/architecture" },
  { name: "toc", path: "/concepts/risk" },
  { name: "404", path: "/non-existent-page" },
] as const

async function stubExternalNetwork(page: Page) {
  await page.route("**/api.binance.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
  await page.route("**/oracle.biscotti-proxy-worker.workers.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
}

for (const theme of THEMES) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`docs visual ${theme} theme, ${viewportName}`, () => {
      test.use({ viewport, reducedMotion: "reduce" })

      test.beforeEach(async ({ page }) => {
        await stubExternalNetwork(page)
        await page.addInitScript((t) => {
          window.localStorage.setItem("so4-theme", t)
          document.documentElement.classList.toggle("dark", t === "dark")
        }, theme)
        await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") })
        await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"))
      })

      for (const state of STATES) {
        test(state.name, async ({ page }) => {
          await page.goto(state.path)
          await page.waitForLoadState("networkidle")

          await expect(page).toHaveScreenshot(
            `docs-${state.name}-${theme}-${viewportName}.png`,
            {
              fullPage: true,
              animations: "disabled",
            },
          )
        })
      }

      test("search-dialog", async ({ page }) => {
        await page.goto("/")
        await page.waitForLoadState("networkidle")

        // Open search dialog by clicking search button or triggering keyboard shortcut
        const searchButton = page.getByRole("button", { name: /search/i })
        if (await searchButton.isVisible()) {
          await searchButton.click()
        } else {
          await page.keyboard.press("ControlOrMeta+K")
        }

        const searchDialog = page.getByRole("dialog")
        await expect(searchDialog).toBeVisible()

        // Type a sample query to populate search results list
        const searchInput = page.getByRole("textbox", { name: /query|search/i })
        if (await searchInput.isVisible()) {
          await searchInput.fill("margin")
        }

        await expect(page).toHaveScreenshot(
          `docs-search-${theme}-${viewportName}.png`,
          {
            fullPage: true,
            animations: "disabled",
          },
        )
      })
    })
  }
}
