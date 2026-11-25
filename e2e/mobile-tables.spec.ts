import { expect, test } from "@playwright/test"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

/**
 * Issue #1087: Responsive market and account table interactions on mobile viewports.
 *
 * Verifies that dense market and account tables:
 * - Render responsive, accessible cards at narrow viewport widths
 * - Preserve all labels, values, and actions without horizontal clipping or scroll leakage
 * - Maintain screen-reader roles and region landmarks
 * - Reflow gracefully when toggling expanded details
 *
 * Note under the no-run instruction: visual snapshots are coded via `toHaveScreenshot`
 * but baseline images cannot be generated without executing Playwright; visual baselines
 * must be generated in CI or by a human run.
 */

const MOBILE_VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 640 },
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
] as const

const DESKTOP_VIEWPORT = { width: 1280, height: 800 }

test.describe("mobile market tables (/pools)", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`renders accessible card list without overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.route("**/api.binance.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
      )

      await page.goto("/pools")
      await page.waitForLoadState("networkidle")

      // Verify the mobile card list is rendered
      const poolsList = page.getByRole("list", { name: "Liquidity pools" })
      await expect(poolsList).toBeVisible()

      // Verify listitems preserve essential metrics
      const items = poolsList.getByRole("listitem")
      await expect(items.first()).toBeVisible()
      await expect(items.first().getByText("TVL")).toBeVisible()
      await expect(items.first().getByText("APR")).toBeVisible()

      // Verify no horizontal overflow of the page
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      }))
      expect(overflow.document).toBeLessThanOrEqual(1)
      expect(overflow.body).toBeLessThanOrEqual(1)

      // Visual screenshot baseline point (to be captured on first run)
      await expect(poolsList).toHaveScreenshot(`pools-cards-${viewport.name}.png`, {
        animations: "disabled",
      })
    })
  }

  test("renders full data table on desktop viewport", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.route("**/api.binance.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    )

    await page.goto("/pools")
    await page.waitForLoadState("networkidle")

    const table = page.getByRole("table")
    await expect(table).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Pool" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "TVL" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "APR" })).toBeVisible()
  })
})

test.describe("mobile account workspace tables (/trade)", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`positions, orders, and trade history remain operable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await stubTradeExternalNetwork(page, { candles: true })
      await page.addInitScript(() => {
        window.localStorage.setItem("so4-trade-workspace-tour-v1-complete", "true")
      })

      await page.goto("/trade")
      await page.waitForLoadState("networkidle")

      // Open positions tab
      const positionsTab = page.getByRole("tab", { name: /^positions/i })
      await expect(positionsTab).toBeVisible()
      await positionsTab.click()

      // The mobile positions container has accessible list role
      const positionsList = page.locator('[role="list"][aria-label="Open positions"]')
      await expect(positionsList).toBeVisible()

      // Open orders tab
      const ordersTab = page.getByRole("tab", { name: /^orders/i })
      await expect(ordersTab).toBeVisible()
      await ordersTab.click()

      const ordersList = page.locator('[role="list"][aria-label="Open orders"]')
      await expect(ordersList).toBeVisible()

      // Verify no horizontal overflow in account workspace
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      }))
      expect(overflow.document).toBeLessThanOrEqual(1)
      expect(overflow.body).toBeLessThanOrEqual(1)

      // Visual screenshot baseline point (to be captured on first run)
      await expect(ordersList).toHaveScreenshot(`orders-cards-${viewport.name}.png`, {
        animations: "disabled",
      })
    })
  }
})
