import { expect, test } from "@playwright/test"
import { stubTradeExternalNetwork } from "./helpers/trade-network"

// OB-128: bounded long-session run with repeated market / panel changes.
// Records memory, timer, request, and input-latency proxies. Unexplained
// growth fails the test.

type Sample = {
  heap: number
  timerCount: number
  requests: number
  inputLatencyMs: number
}

test.describe("trade long-session regression", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })

  test("repeated market and panel churn stays bounded", async ({ page }) => {
    let requestCount = 0
    await stubTradeExternalNetwork(page)
    page.on("request", () => {
      requestCount += 1
    })

    await page.addInitScript(() => {
      const originalSetTimeout = window.setTimeout.bind(window)
      const originalClearTimeout = window.clearTimeout.bind(window)
      const originalSetInterval = window.setInterval.bind(window)
      const originalClearInterval = window.clearInterval.bind(window)
      const active = new Set<ReturnType<typeof setTimeout>>()
      const timedWindow = window as Window & {
        __so4TimerCount?: () => number
      }
      timedWindow.__so4TimerCount = () => active.size
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: Array<unknown>) => {
        const id = originalSetTimeout(handler, timeout, ...args)
        active.add(id)
        return id
      }) as typeof window.setTimeout
      window.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
        if (id !== undefined) active.delete(id)
        return originalClearTimeout(id)
      }) as typeof window.clearTimeout
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: Array<unknown>) => {
        const id = originalSetInterval(handler, timeout, ...args)
        active.add(id)
        return id
      }) as typeof window.setInterval
      window.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
        if (id !== undefined) active.delete(id)
        return originalClearInterval(id)
      }) as typeof window.clearInterval
    })

    await page.goto("/trade")
    await page.waitForLoadState("networkidle")

    async function sample(): Promise<Sample> {
      const start = Date.now()
      await page.getByRole("tab", { name: "Long" }).click()
      await page.getByRole("tab", { name: "Short" }).click()
      const inputLatencyMs = Date.now() - start
      const metrics = await page.evaluate(() => {
        const w = window as Window & {
          performance: Performance & { memory?: { usedJSHeapSize: number } }
          __so4TimerCount?: () => number
        }
        const heap =
          typeof w.performance.memory?.usedJSHeapSize === "number"
            ? w.performance.memory.usedJSHeapSize
            : 0
        const timerCount =
          typeof w.__so4TimerCount === "function" ? w.__so4TimerCount() : 0
        return { heap, timerCount }
      })
      return {
        heap: metrics.heap,
        timerCount: metrics.timerCount,
        requests: requestCount,
        inputLatencyMs,
      }
    }

    const baseline = await sample()
    const panels = ["positions", "orders", "history"] as const

    for (let i = 0; i < 12; i += 1) {
      const panel = panels[i % panels.length]
      await page.getByRole("tab", { name: new RegExp(`^${panel}`, "i") }).click()
      // Flip ticket tabs to simulate bursty interaction.
      await page.getByRole("tab", { name: i % 2 === 0 ? "Long" : "Short" }).click()
    }

    const after = await sample()

    // Input stays interactive (INP-ish proxy under a generous lab budget).
    expect(after.inputLatencyMs).toBeLessThan(2000)

    // Timer set must not grow without bound across the session.
    expect(after.timerCount).toBeLessThanOrEqual(baseline.timerCount + 25)

    // Heap may be 0 when performance.memory is unavailable; otherwise allow
    // modest growth but fail on multi-fold expansion.
    if (baseline.heap > 0 && after.heap > 0) {
      expect(after.heap).toBeLessThan(baseline.heap * 3 + 8_000_000)
    }

    // Request volume is recorded for the long-session report; keep it finite.
    expect(after.requests).toBeGreaterThan(0)
    expect(after.requests).toBeLessThan(5_000)

    await test.info().attach("trade-long-session-sample", {
      body: Buffer.from(
        JSON.stringify(
          {
            name: "trade-long-session",
            baseline,
            after,
            delta: {
              heap: after.heap - baseline.heap,
              timerCount: after.timerCount - baseline.timerCount,
              requests: after.requests - baseline.requests,
            },
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    })
  })
})
