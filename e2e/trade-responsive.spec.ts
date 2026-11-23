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

for (const viewport of VIEWPORTS) {
  test.describe(`trade responsive ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test.beforeEach(async ({ page }) => {
      await stubTradeExternalNetwork(page)
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "so4-trade-workspace-tour-v1-complete",
          "true"
        )
      })
    })

    test("core controls stay inside the viewport", async ({ page }) => {
      await page.goto("/trade")
      await page.waitForLoadState("networkidle")

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
        await page.goto("/trade")
        await page.waitForLoadState("networkidle")

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
      await page.goto("/trade")
      await page.waitForLoadState("networkidle")

      const navbar = page.locator("nav.so4-scroll-header")
      await navbar.getByRole("button", { name: "Connect wallet" }).click()

      const dialog = page.getByRole("dialog", { name: "Connect Wallet" })
      await assertViewportContained(dialog, viewport)
      await assertNoHorizontalOverflow(page)

      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden()
    })

    if (viewport.width < 1024) {
      test("tabs and account actions remain reachable", async ({ page }) => {
        await page.goto("/trade")
        await page.waitForLoadState("networkidle")

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
