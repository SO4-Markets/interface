import { expect, test } from "@playwright/test"

test("earn page loads with heading and description", async ({ page }) => {
  await page.goto("/earn")

  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toBeVisible()
  await expect(heading).toContainText("Earn")

  await expect(
    page.getByText("Stake SO4 and buy GLV or GM to earn rewards")
  ).toBeVisible()
})

test("earn page shows all four tab triggers", async ({ page }) => {
  await page.goto("/earn")

  await expect(page.getByRole("tab", { name: "Portfolio" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Discover" })).toBeVisible()
  await expect(
    page.getByRole("tab", { name: "Additional opportunities" })
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: "Distributions" })).toBeVisible()
})

test("earn page switches content when clicking Discover tab", async ({
  page,
}) => {
  await page.goto("/earn")

  await page.getByRole("tab", { name: "Discover" }).click()
  await expect(page.getByRole("tabpanel")).toBeVisible()
})

test("earn page switches content when clicking Distributions tab", async ({
  page,
}) => {
  await page.goto("/earn")

  await page.getByRole("tab", { name: "Distributions" }).click()
  await expect(page.getByRole("tabpanel")).toBeVisible()
})
