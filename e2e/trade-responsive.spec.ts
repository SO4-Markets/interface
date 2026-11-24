import { expect, test, type Locator, type Page } from "@playwright/test"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

const VIEWPORTS = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
] as const

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))

  expect(overflow.document).toBeLessThanOrEqual(1)
  expect(overflow.body).toBeLessThanOrEqual(1)
}

async function assertHorizontallyContained(locator: Locator, width: number) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
}

async function assertViewportContained(
  locator: Locator,
  viewport: { width: number; height: number }
) {
  await assertHorizontallyContained(locator, viewport.width)
  const box = await locator.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
}

/** Loads /trade and waits for the workspace, not just the route fallback. */
async function gotoTrade(page: Page) {
  await page.goto("/trade")
  await page.waitForLoadState("networkidle")
  await expect(page.getByTestId("market-stats")).toBeVisible({ timeout: 30_000 })
}

/** Fails if any other visible control shares a pixel with `locator`. */
async function assertNotOverlappingControls(locator: Locator) {
  await expect(locator).toBeVisible()
  const overlaps = await locator.evaluate((target) => {
    const own = target.getBoundingClientRect()
    const controls = document.querySelectorAll<HTMLElement>(
      "button, a[href], [role='tab'], input, select"
    )
    return Array.from(controls)
      .filter((el) => el !== target && !target.contains(el) && !el.contains(target))
      .filter((el) => el.checkVisibility() && !el.closest("[aria-hidden='true'], [inert]"))
      // The TanStack devtools launcher only exists on the dev server.
      .filter((el) => !/devtools/i.test(el.getAttribute("aria-label") ?? ""))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return false
        return r.left < own.right - 1 && r.right > own.left + 1 && r.top < own.bottom - 1 && r.bottom > own.top + 1
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40))
  })
  expect(overlaps).toEqual([])
}

for (const viewport of VIEWPORTS) {
  test.describe(`trade responsive ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test.beforeEach(async ({ page }) => {
      await stubTradeExternalNetwork(page, { candles: true })
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "so4-trade-workspace-tour-v1-complete",
          "true"
        )
      })
    })

    test("core controls stay inside the viewport", async ({ page }) => {
      await gotoTrade(page)

      const navbar = page.locator("nav.so4-scroll-header")
      await assertHorizontallyContained(
        navbar.getByRole("button", { name: "Connect wallet" }),
        viewport.width
      )
      await assertHorizontallyContained(
        page.getByRole("button", { name: "Help", exact: true }),
        viewport.width
      )

      const stats = page.getByTestId("market-stats")
      await assertHorizontallyContained(stats, viewport.width)
      await expect(
        stats.getByText("24h Volume", { exact: false })
      ).toBeVisible()
      await expect(
        stats.getByText("Oracle price", { exact: false })
      ).toBeVisible()

      await assertNoHorizontalOverflow(page)
    })

    if (viewport.width < 1280) {
      test("compact navigation fits, opens, and dismisses with Escape", async ({
        page,
      }) => {
        await gotoTrade(page)

        const navbar = page.locator("nav.so4-scroll-header")
        const toggle = navbar.getByRole("button", { name: "Open menu" })
        await assertHorizontallyContained(toggle, viewport.width)
        await toggle.click()

        const menu = page.locator("#app-navigation-menu")
        await assertViewportContained(menu, viewport)
        await expect(menu.getByRole("link", { name: "Trade" })).toBeVisible()
        await expect(
          menu.getByRole("button", { name: "What's new" })
        ).toBeVisible()

        await assertNoHorizontalOverflow(page)
        await page.keyboard.press("Escape")
        await expect(menu).toBeHidden()
      })
    }

    test("wallet dialog fits and dismisses with Escape", async ({ page }) => {
      await gotoTrade(page)

      const navbar = page.locator("nav.so4-scroll-header")
      await navbar.getByRole("button", { name: "Connect wallet" }).click()

      const dialog = page.getByRole("dialog", { name: "Connect Wallet" })
      await assertViewportContained(dialog, viewport)
      await assertNoHorizontalOverflow(page)

      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden()
    })

    test("chart source, candle values, and view controls reflow inside the viewport", async ({
      page,
    }) => {
      await gotoTrade(page)

      const meta = page.getByTestId("chart-meta")
      const legend = meta.getByTestId("ohlc-legend")
      await expect(legend).toBeVisible({ timeout: 15_000 })
      for (const item of await legend.locator(":scope > div").all()) {
        await assertHorizontallyContained(item, viewport.width)
      }
      await assertHorizontallyContained(meta.getByText("testnet"), viewport.width)
      const view = meta.getByRole("group", { name: "Chart view" })
      for (const name of ["Zoom out chart", "Zoom in chart", "Fit all candles in view"]) {
        await assertHorizontallyContained(view.getByRole("button", { name }), viewport.width)
      }
      const timeframes = page.getByRole("group", { name: "Chart timeframe selection" })
      for (const button of await timeframes.getByRole("button").all()) {
        await assertHorizontallyContained(button, viewport.width)
      }
      // Vertical swipes over the chart scroll the page instead of being eaten.
      await expect(
        page.getByRole("region", { name: /^Price chart for/ })
      ).toHaveCSS("touch-action", "pan-y")
      await assertNoHorizontalOverflow(page)
    })

    test("help sits clear of every control and lists its shortcuts", async ({
      page,
    }) => {
      await gotoTrade(page)

      const help = page.getByRole("button", { name: "Help", exact: true })
      await assertHorizontallyContained(help, viewport.width)
      await assertNotOverlappingControls(help)

      await help.click()
      const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
      await assertViewportContained(dialog, viewport)
      // The list used to collapse to a 10px column and render blank.
      const row = dialog.getByText("Open keyboard shortcuts help")
      await expect(row).toBeVisible()
      expect((await row.boundingBox())!.width).toBeGreaterThan(100)
      await assertHorizontallyContained(
        dialog.locator("kbd").first(),
        viewport.width
      )
      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden()
      await expect(help).toBeFocused()
    })

    if (viewport.width < 1024) {
      test("tabs and account actions remain reachable", async ({ page }) => {
        await gotoTrade(page)

        const panelNav = page.getByRole("tablist", { name: "Trading panels" })
        await assertHorizontallyContained(panelNav, viewport.width)
        await panelNav.getByRole("tab", { name: "Trade" }).click()
        await expect(page.locator("#mobile-trade-view-trade")).toBeVisible()
        await assertHorizontallyContained(
          page.locator("#mobile-trade-view-trade"),
          viewport.width
        )

        await panelNav.getByRole("tab", { name: "Positions" }).click()
        const accountTabs = page.getByRole("tablist", {
          name: "Account activity",
        })
        await assertHorizontallyContained(
          page.getByTestId("account-tabs-viewport"),
          viewport.width
        )
        await expect(
          accountTabs.getByRole("tab", { name: /^Positions/ })
        ).toBeVisible()

        const fundingTab = accountTabs.getByRole("tab", {
          name: "Funding & Fees",
        })
        await fundingTab.scrollIntoViewIfNeeded()
        await fundingTab.click()
        await expect(fundingTab).toHaveAttribute("aria-selected", "true")

        await assertNoHorizontalOverflow(page)
      })
    }
  })
}

// Coarse-pointer phones: chart controls grow to the shared 44px touch target.
for (const viewport of VIEWPORTS.filter((v) => v.width < 768)) {
  test.describe(`trade touch controls ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
    })

    test("chart controls meet the touch target and stay reachable", async ({ page }) => {
      await stubTradeExternalNetwork(page, { candles: true })
      await page.addInitScript(() => {
        window.localStorage.setItem("so4-trade-workspace-tour-v1-complete", "true")
      })
      await gotoTrade(page)
      const timeframes = page.getByRole("group", { name: "Chart timeframe selection" })
      await expect(page.getByTestId("ohlc-legend")).toBeVisible({ timeout: 15_000 })

      const controls = [
        ...(await timeframes.getByRole("button").all()),
        ...(await page.getByRole("group", { name: "Chart view" }).getByRole("button").all()),
        page.getByRole("button", { name: /OHLC Data/ }),
        page.getByRole("button", { name: "Help", exact: true }),
      ]
      for (const control of controls) {
        await assertHorizontallyContained(control, viewport.width)
        const box = (await control.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }

      // The highlight still sits under the selected timeframe at touch size.
      const active = timeframes.getByRole("button", { name: "5m timeframe", exact: true })
      const indicator = timeframes.locator("[role='presentation']")
      const [a, i] = [(await active.boundingBox())!, (await indicator.boundingBox())!]
      expect(Math.abs(a.x - i.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(a.width - i.width)).toBeLessThanOrEqual(1)

      await page.getByRole("button", { name: "Zoom in chart" }).tap()
      await page.getByRole("button", { name: "Fit all candles in view" }).tap()
      await assertNoHorizontalOverflow(page)
    })
  })
}
