import { expect, test } from "@playwright/test"

test("referrals page loads with heading and description", async ({ page }) => {
  await page.goto("/referrals")

  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toBeVisible()
  await expect(heading).toContainText("Referrals")

  await expect(
    page.getByText(
      "Get fee discounts and earn up to 15% commission through the SO4 referral program"
    )
  ).toBeVisible()
})

test("referrals page shows trader and affiliate tabs", async ({ page }) => {
  await page.goto("/referrals")

  await expect(page.getByRole("tab", { name: "Traders" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Affiliates" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Distributions" })).toBeVisible()
})

test("referrals page shows sidebar with FAQ and quick links", async ({
  page,
}) => {
  await page.goto("/referrals")

  await expect(page.getByText("How it works")).toBeVisible()
  await expect(page.getByText("Claiming rewards")).toBeVisible()
  await expect(page.getByText("Tiers")).toBeVisible()
})

test("referrals page sidebar shows disconnected state for referral code", async ({
  page,
}) => {
  await page.goto("/referrals")

  await expect(page.getByText("No referral code active")).toBeVisible()
  await expect(
    page.getByText("Enter a code to get a fee discount")
  ).toBeVisible()
})
