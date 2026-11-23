import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

// Issue #1049: chart controls on touch devices. Phone viewport with touch
// emulation, so the `touch-target` utility (pointer: coarse) applies.

const MIN_TOUCH_TARGET = 44
const FIVE_MINUTES_MS = 5 * 60 * 1000

function buildKlines(count: number) {
  const end = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const open = 60_000 + i * 10
    return [end - (count - i) * FIVE_MINUTES_MS, `${open}`, `${open + 50}`, `${open - 50}`, `${open + 20}`, "1"]
  })
}

const chart = (page: Page) => page.getByRole("region", { name: "Price chart for BTC/USD" })

async function openTrade(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("so4-trade-workspace-tour-v1-complete", "true")
  })
  await page.route("**/api.binance.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().url().includes("/klines") ? JSON.stringify(buildKlines(60)) : "[]",
    }),
  )
  await page.routeWebSocket("wss://stream.binance.com:9443/**", (ws) => {
    ws.close()
  })
  await page.goto("/trade")
  await expect(chart(page).locator("canvas").first()).toBeAttached({ timeout: 20_000 })
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error("element has no layout box")
  return rect
}

const mobileTab = (page: Page, name: string) =>
  page.getByRole("tablist", { name: "Trading panels" }).getByRole("tab", { name })

test.describe("chart controls on a phone", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test("the Chart tab gives the chart a usable height", async ({ page }) => {
    await openTrade(page)

    await expect(chart(page)).toBeVisible()
    expect((await box(chart(page))).height).toBeGreaterThanOrEqual(150)
    await expect(page.getByRole("complementary", { name: "Order book depth" })).toBeHidden()
  })

  test("chart controls meet the 44px touch target and fit at 360px", async ({ page }) => {
    await openTrade(page)

    const controls = [
      ...(await page.getByRole("button", { name: /timeframe$/ }).all()),
      page.getByRole("button", { name: "BTC/USD", exact: true }),
      page.getByRole("button", { name: "Clear selected market" }),
      page.getByRole("button", { name: /OHLC Data/ }),
    ]
    expect(controls).toHaveLength(9)
    for (const control of controls) {
      const rect = await box(control)
      expect(rect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
      expect(rect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    }

    const toolbar = page.getByRole("group", { name: "Chart timeframe selection" })
    const overflow = await toolbar.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("vertical swipes on the chart are left to the page", async ({ page }) => {
    await openTrade(page)

    await expect(chart(page)).toHaveCSS("touch-action", "pan-y")
  })

  test("the OHLC table scrolls inside the chart panel and can be hidden", async ({ page }) => {
    await openTrade(page)

    const toggle = page.getByRole("button", { name: /OHLC Data/ })
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")

    const table = page.locator("#ohlc-data-table")
    await expect(table).toBeVisible()
    const nav = await box(page.getByRole("tablist", { name: "Trading panels" }))
    expect((await box(table)).y + (await box(table)).height).toBeLessThanOrEqual(nav.y)
    expect((await box(chart(page))).height).toBeGreaterThan(0)
    await expect(toggle).toBeInViewport()

    await toggle.click()
    await expect(table).toBeHidden()
  })

  test("each bottom tab shows only its own panel", async ({ page }) => {
    await openTrade(page)
    const chartTop = (await box(chart(page))).y

    await mobileTab(page, "Book").click()
    await expect(page.getByRole("complementary", { name: "Order book depth" })).toBeVisible()
    await expect(chart(page)).toBeHidden()

    await mobileTab(page, "Positions").click()
    await expect(chart(page)).toBeHidden()
    const positions = await box(page.locator("#mobile-trade-view-positions"))
    expect(positions.y).toBeLessThan(chartTop)
  })

  test("the floating Help button does not cover chart controls", async ({ page }) => {
    await openTrade(page)

    await expect(page.getByRole("button", { name: "Help" })).toBeHidden()
  })
})

test.describe("chart controls with a keyboard", () => {
  test("the market picker moves with arrow keys and selects with Enter", async ({ page }) => {
    await openTrade(page)

    await page.getByRole("button", { name: "BTC/USD", exact: true }).focus()
    await page.keyboard.press("Enter")
    const search = page.getByRole("combobox", { name: "Search markets" })
    await expect(search).toBeFocused()

    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect(page.getByRole("button", { name: "XLM/USD", exact: true })).toBeVisible()
  })
})

test.describe("chart controls on desktop", () => {
  test("chart and book stay side by side with compact timeframe buttons", async ({ page }) => {
    await openTrade(page)

    await expect(chart(page)).toBeVisible()
    await expect(page.getByRole("complementary", { name: "Order book depth" })).toBeVisible()
    const timeframe = await box(page.getByRole("button", { name: "1m timeframe" }))
    expect(timeframe.height).toBeLessThan(MIN_TOUCH_TARGET)
  })
})
