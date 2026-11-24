import type { Page } from "@playwright/test"

type StubOptions = {
  /**
   * Serve a deterministic candle history from the klines endpoint instead of
   * an empty list, so the chart, its legend, and its controls render with
   * data. Every other Binance REST call still gets an empty list.
   */
  candles?: boolean
}

const CANDLE_COUNT = 120
const CANDLE_END_MS = Date.UTC(2026, 0, 1)
const CANDLE_STEP_MS = 5 * 60 * 1000

/** Binance kline rows: [openTime, open, high, low, close, volume, ...]. */
function syntheticKlines(): Array<Array<string | number>> {
  return Array.from({ length: CANDLE_COUNT }, (_, i) => {
    const open = 80_000 + Math.sin(i / 6) * 400 + i * 3
    const close = open + Math.cos(i / 4) * 120
    const high = Math.max(open, close) + 60
    const low = Math.min(open, close) - 60
    const time = CANDLE_END_MS - (CANDLE_COUNT - i) * CANDLE_STEP_MS
    return [time, open.toFixed(4), high.toFixed(4), low.toFixed(4), close.toFixed(4), "12.5"]
  })
}

/** Stub outbound chart/oracle feeds so trade e2e never depends on the network. */
export async function stubTradeExternalNetwork(page: Page, options: StubOptions = {}) {
  await page.route("**/api.binance.com/**", (route) => {
    const isKlines = new URL(route.request().url()).pathname.endsWith("/klines")
    const body = options.candles && isKlines ? JSON.stringify(syntheticKlines()) : "[]"
    return route.fulfill({ status: 200, contentType: "application/json", body })
  })
  await page.routeWebSocket("wss://stream.binance.com:9443/**", (ws) => {
    ws.close()
  })
}
