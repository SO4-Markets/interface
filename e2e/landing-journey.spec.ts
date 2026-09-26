import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const widths = [390, 768, 1440]
const motions = ["no-preference", "reduce"] as const

async function stubExternalNetwork(page: Page) {
  await page.route("**/api.binance.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  )
  await page.route("**/oracle.biscotti-proxy-worker.workers.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  )
  await page.routeWebSocket("wss://stream.binance.com:9443/**", (ws) =>
    ws.close()
  )
}

async function observeLayoutShifts(page: Page) {
  await page.addInitScript(() => {
    ;(window as typeof window & { __so4Cls: number }).__so4Cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput: boolean
          value: number
        }
        if (!shift.hadRecentInput) {
          ;(window as typeof window & { __so4Cls: number }).__so4Cls +=
            shift.value
        }
      }
    }).observe({ type: "layout-shift", buffered: true })
  })
}

async function readLabEvidence(page: Page) {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType(
      "resource"
    ) as Array<PerformanceResourceTiming>
    const bytes = resources.reduce(
      (total, resource) =>
        total +
        (resource.transferSize ||
          resource.encodedBodySize ||
          resource.decodedBodySize),
      0
    )

    return {
      cls: (window as typeof window & { __so4Cls: number }).__so4Cls,
      requestCount: resources.length,
      transferBytes: bytes,
    }
  })
}

for (const width of widths) {
  for (const reducedMotion of motions) {
    test(`landing journey at ${width}px with ${reducedMotion} motion`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion })
      await stubExternalNetwork(page)
      await observeLayoutShifts(page)
      await page.goto("/")
      await page.waitForLoadState("networkidle")

      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      ).toBe(true)
      for (const label of [
        "Self-custodied",
        "Unified liquidity",
        "Open source",
      ]) {
        await expect(page.getByText(label, { exact: true })).toHaveCount(1)
      }
      const highlights = page.getByText("Self-custodied", { exact: true })
      await highlights.scrollIntoViewIfNeeded()
      await expect(highlights).toBeVisible()

      const sponsorCards = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Built on" }),
      })
      for (const name of ["Stellar", "Soroban", "Binance", "GMX Oracle"]) {
        const card = sponsorCards.getByText(name, { exact: true })
        await card.scrollIntoViewIfNeeded()
        await expect(card).toBeVisible()
        expect((await card.boundingBox())?.height).toBe(80)
      }

      const communitySection = page.locator("section").filter({
        has: page.getByRole("heading", { name: /driven by\s+our community/i }),
      })
      expect(
        await communitySection.evaluate(
          (element) => element.getAnimations({ subtree: true }).length
        )
      ).toBe(0)
      const githubLink = communitySection.getByRole("link", {
        name: /github/i,
      })
      await githubLink.focus()
      await expect(githubLink).toBeFocused()

      const question = page.getByRole("button", { name: /what is so4/i })
      await question.scrollIntoViewIfNeeded()
      await question.click()
      await expect(question).toHaveAttribute("aria-expanded", "true")
      await question.click()
      await expect(question).toHaveAttribute("aria-expanded", "false")

      if (reducedMotion === "reduce") {
        await expect(
          page.locator('[data-slot="accordion-content"]').first()
        ).toHaveCSS("transition-property", "none")
      }

      if (width === 390) {
        const menu = page.getByRole("button", { name: "Open menu" })
        await menu.click()
        await expect(
          page.getByRole("dialog", { name: "Site menu" })
        ).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(menu).toBeFocused()
      }

      const cta = page.getByRole("link", { name: "Trade now" }).first()
      const evidence = await readLabEvidence(page)
      expect(evidence.cls).toBeLessThanOrEqual(0.1)
      expect(evidence.requestCount).toBeGreaterThan(0)
      expect(evidence.transferBytes).toBeGreaterThan(0)
      if (process.env.PLAYWRIGHT_LANDING_AUDIT === "1") {
        console.info(
          `[landing-audit] ${JSON.stringify({ width, reducedMotion, ...evidence })}`
        )
      }
      await testInfo.attach("landing-lab-evidence.json", {
        body: JSON.stringify({ width, reducedMotion, ...evidence }, null, 2),
        contentType: "application/json",
      })

      await cta.click()
      await expect(page).toHaveURL(/\/trade$/)
      await expect(page.getByRole("tab", { name: "Long" })).toBeVisible({
        timeout: 15_000,
      })
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter((animation) => animation.playState === "running").length
          )
        )
        .toBe(0)
    })
  }
}
