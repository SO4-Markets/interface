import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

test("faq accordion opens via keyboard and is wired to its panel", async ({
  page,
}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  const trigger = page.getByRole("button", { name: /what is so4/i })
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  const controls = await trigger.getAttribute("aria-controls")
  expect(controls).toBeTruthy()

  // Retry past hydration: the trigger is server-rendered and only starts
  // responding to Enter once React has attached its handler.
  await expect(async () => {
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 1000,
    })
  }).toPass({ timeout: 15_000 })
  await expect(page.locator(`#${controls}`)).toHaveAttribute(
    "aria-hidden",
    "false"
  )
})

test("roadmap scroller is keyboard reachable", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  const scroller = page.getByRole("group", { name: /roadmap timeline/i })
  await expect(scroller).toHaveAttribute("tabindex", "0")
  await scroller.focus()
  await expect(scroller).toBeFocused()
})

test("mobile menu is a modal dialog and locks body scroll", async ({
  page,
}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")

  // The burger is server-rendered, so it is clickable before React has
  // attached its onClick. Retry the open until the panel actually appears
  // rather than racing hydration.
  const burger = page.getByRole("button", { name: /open menu/i })
  const dialog = page.locator('[role="dialog"]')
  await expect(async () => {
    await burger.click()
    await expect(dialog).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })

  await expect(dialog).toHaveAttribute("aria-modal", "true")
  await expect(dialog).toHaveAttribute("aria-label", "Site menu")
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden")

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(burger).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden"
  )
})

test("mobile menu route change restores scrolling and renders the destination", async ({
  page,
}) => {
  await page.goto("/")
  const burger = page.getByRole("button", { name: /open menu/i })
  const dialog = page.getByRole("dialog", { name: "Site menu" })
  await expect(async () => {
    await burger.click()
    await expect(dialog).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await dialog.getByRole("link", { name: "Pools", exact: true }).click()
  await expect(page).toHaveURL(/\/pools$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Pools" })
  ).toBeVisible()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden"
  )
})

test("open mobile menu closes cleanly at the desktop breakpoint", async ({
  page,
}) => {
  await page.goto("/")
  const burger = page.getByRole("button", { name: /open menu/i })
  const dialog = page.getByRole("dialog", { name: "Site menu" })
  await expect(async () => {
    await burger.click()
    await expect(dialog).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })

  await page.setViewportSize({ width: 768, height: 900 })
  await expect(dialog).toBeHidden()
  await expect(
    page.locator("header ul").first().getByRole("link", { name: "Trade" })
  ).toBeFocused()
})

test("desktop navigation renders the destination", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page
    .locator("header ul")
    .first()
    .getByRole("link", { name: "Pools", exact: true })
    .click()
  await expect(page).toHaveURL(/\/pools$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Pools" })
  ).toBeVisible()
})

test("faq survives rapid toggles, long content, and enlarged text", async ({
  page,
}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  const trigger = page.getByRole("button", { name: /what is so4/i })
  // Prove hydration has attached the React handler before delivering the
  // deliberately batched clicks below. The trigger is server-rendered, so
  // network-idle alone does not guarantee that it is interactive yet.
  await expect(async () => {
    await trigger.focus()
    await trigger.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 1000,
    })
  }).toPass({ timeout: 15_000 })
  await trigger.press("Enter")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")

  await trigger.evaluate((element) => {
    element.click()
    element.click()
    element.click()
  })
  await expect(trigger).toHaveAttribute("aria-expanded", "true")

  const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`)
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2"
    const answer = document.querySelector(
      '[data-slot="accordion-content"][data-state="open"] p'
    )
    if (answer) answer.prepend(`${answer.textContent} `.repeat(8))
  })
  await expect(panel).toHaveAttribute("aria-hidden", "false")
  await expect(panel.locator("a")).toBeVisible()
  await expect
    .poll(() =>
      panel.evaluate((element) => {
        const content = element.firstElementChild
        const link = element.querySelector("a")
        if (!content || !link) return false

        return (
          content.scrollHeight <= content.clientHeight + 1 &&
          link.getBoundingClientRect().bottom <=
            element.getBoundingClientRect().bottom + 1
        )
      })
    )
    .toBe(true)

  await trigger.press("Enter")
  await expect(panel).toHaveAttribute("inert", "")
  await expect(trigger).toBeFocused()
})

test("fixed header preserves content geometry and the main anchor offset", async ({
  page,
}) => {
  await page.goto("/#main-content")
  await page.waitForLoadState("networkidle")

  const header = page.locator("header")
  const heading = page.getByRole("heading", { level: 1 })
  const [headerBox, headingBox] = await Promise.all([
    header.boundingBox(),
    heading.boundingBox(),
  ])

  expect(headerBox).not.toBeNull()
  expect(headingBox).not.toBeNull()
  expect(headingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height)
  await expect(page.locator("#main-content")).toHaveCSS(
    "scroll-margin-top",
    "64px"
  )
})
