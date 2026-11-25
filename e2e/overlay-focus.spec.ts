import { expect, test, type Locator, type Page } from "@playwright/test"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

async function tabStaysInside(page: Page, container: Locator, presses: number) {
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press("Tab")
    await expect
      .poll(() => container.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true)
  }
}

test.describe("trade overlays", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })

  test.beforeEach(async ({ page }) => {
    await stubTradeExternalNetwork(page)
    await page.goto("/trade")
    await page.waitForLoadState("networkidle")
  })

  test("the workspace tour traps Tab and returns focus to Help on Escape", async ({ page }) => {
    const tour = page.getByRole("dialog", { name: "Choose a market" })
    await expect(tour).toBeFocused()

    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Skip tour" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Next" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Skip tour" })).toBeFocused()
    await page.keyboard.press("Shift+Tab")
    await expect(page.getByRole("button", { name: "Next" })).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(tour).toHaveCount(0)
    await expect(page.locator("[data-tour-help-trigger]")).toBeFocused()
  })

  test("the help dialog traps Tab and restores focus to whatever opened it", async ({ page }) => {
    await page.keyboard.press("Escape")
    const help = page.locator("[data-tour-help-trigger]")
    await expect(help).toBeFocused()

    await help.click()
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
    await expect(page.getByRole("button", { name: "Replay workspace tour" })).toBeFocused()
    await tabStaysInside(page, dialog, 6)

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(help).toBeFocused()

    const longTab = page.getByRole("tab", { name: "Long" })
    await longTab.focus()
    await page.keyboard.press("Shift+Slash")
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(longTab).toBeFocused()
  })

  test("replaying the tour from Help hands focus from the dialog to the tour and back", async ({ page }) => {
    await page.keyboard.press("Escape")
    await page.locator("[data-tour-help-trigger]").click()
    await page.getByRole("button", { name: "Replay workspace tour" }).click()

    await expect(page.getByRole("dialog", { name: "Choose a market" })).toBeFocused()
    for (const name of ["Next", "Next", "Finish"]) {
      await page.getByRole("button", { name }).click()
    }

    await expect(page.getByTestId("trade-workspace-tour")).toHaveCount(0)
    await expect(page.locator("[data-tour-help-trigger]")).toBeFocused()
  })
})

test.describe("landing mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })

  test("keeps Tab inside the menu and its toggle, and Escape returns to the toggle", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const toggle = page.locator("button[aria-controls='landing-mobile-menu']")
    await toggle.focus()
    await page.keyboard.press("Enter")

    const menu = page.getByRole("dialog", { name: "Site menu" })
    await expect(menu.getByRole("link", { name: "Trade" })).toBeFocused()

    await menu.getByRole("link", { name: "GitHub" }).focus()
    await page.keyboard.press("Tab")
    await expect(toggle).toBeFocused()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await page.keyboard.press("Tab")
    await expect(menu.getByRole("link", { name: "Trade" })).toBeFocused()
    await page.keyboard.press("Shift+Tab")
    await expect(toggle).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(toggle).toBeFocused()
  })
})
