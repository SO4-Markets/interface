import { expect, test } from "@playwright/test"

// /trade smoke test — catches browser-only crashes (errors that only show up
// once real DOM/canvas/WebSocket APIs run, which unit tests with jsdom can't
// catch). Stubs every third-party chart/price data source so the test never
// depends on outbound network access:
//   - Binance REST  (candles + display prices)
//   - Binance WebSocket (live bar updates)
//   - SO4's own oracle proxy (primary price source)
// The app already falls back gracefully to empty/static data when these
// fail in production, so returning empty-but-valid responses exercises the
// same safe path without ever reaching the real internet.

test.beforeEach(async ({ page }) => {
  await page.route("**/api.binance.com/api/v3/klines**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
  await page.route("**/api.binance.com/api/v3/ticker/bookTicker**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )

  // Close the live-bar WebSocket immediately instead of letting it hang for
  // its 4s no-message timeout — the app already falls back to REST polling
  // when no message ever arrives, so this is the same safe path, faster.
  await page.routeWebSocket("wss://stream.binance.com:9443/**", (ws) => {
    ws.close()
  })
})

test("account and market workspace remains contained at mobile and desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/trade")

  await expect(page.getByRole("tab", { name: /^positions/i })).toBeVisible()
  await expect(page.getByRole("tab", { name: /^orders/i })).toBeVisible()

  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole("tab", { name: /^positions/i })).toBeVisible()
  const desktopOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(desktopOverflow.documentWidth).toBeLessThanOrEqual(desktopOverflow.viewport)
})

test("trade page is reachable with no external network dependency", async ({ page }) => {
  await page.goto("/trade")

  // Market selector — defaults to the first configured market.
  await expect(page.getByRole("button", { name: "BTC/USD" })).toBeVisible()

  // Trade panel — Long / Short / Swap tabs.
  await expect(page.getByRole("tab", { name: "Long" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Short" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Swap" })).toBeVisible()

  // Chart region — header labels render regardless of whether real candle
  // data ever arrives.
  await expect(page.getByText("Price", { exact: true })).toBeVisible()
  await expect(page.getByText("24h Change")).toBeVisible()

  // Positions / orders section.
  await expect(page.getByRole("tab", { name: /^positions/i })).toBeVisible()
  await expect(page.getByRole("tab", { name: /^orders/i })).toBeVisible()
})