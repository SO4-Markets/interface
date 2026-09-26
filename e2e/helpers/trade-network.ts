import type { Page } from "@playwright/test"

/** Stub outbound chart/oracle feeds so trade e2e never depends on the network. */
export async function stubTradeExternalNetwork(page: Page) {
  await page.route("**/api.binance.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
  await page.route("**/oracle.biscotti-proxy-worker.workers.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
  await page.routeWebSocket("wss://stream.binance.com:9443/**", (ws) => {
    ws.close()
  })
}
