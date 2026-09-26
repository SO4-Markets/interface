import { HttpResponse, http } from "msw"

import { mockArchiveChangelog, mockRecentChangelog } from "./data/changelog"
import {
  mockAccountSnapshot,
  mockMarketMetadata,
  mockOrderBookSnapshot,
  mockRecentTrades,
} from "./data/order-book"

type RpcBody = { id?: string | number; method?: string }

// Default Soroban RPC response shape for a successful simulateTransaction call.
// Tests that need a different shape (error, malformed) should use server.use()
// to override this handler for their specific request.
const simulateTransactionSuccess = {
  cost: { cpuInsns: "1000", memBytes: "1000" },
  results: [{ auth: [], xdr: "AAAAAA==" }],
  minResourceFee: "1000000",
  latestLedger: 12345,
  transactionData: "",
}

export const handlers = [
  http.post("https://soroban-testnet.stellar.org", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as RpcBody

    if (body.method === "simulateTransaction") {
      return HttpResponse.json({
        jsonrpc: "2.0",
        id: body.id ?? 1,
        result: simulateTransactionSuccess,
      })
    }

    return HttpResponse.json({ jsonrpc: "2.0", id: body.id ?? 1, result: {} })
  }),

  http.get("https://horizon-testnet.stellar.org/:path*", () => HttpResponse.json({})),

  // Generated changelog data (DX-012). Every test file sees these, including
  // pages that render the navbar (its what's-new indicator fetches
  // /changelog.json).
  http.get("*/changelog.json", () => HttpResponse.json(mockRecentChangelog)),
  http.get("*/changelog.archive.json", () => HttpResponse.json(mockArchiveChangelog)),

  // Order book fixtures (OB-008). Deterministic market, depth, and trade data.
  // Tests override these with server.use() for specific scenarios (empty, stale, error).
  http.get("*/api/market/:symbol", ({ params }) => {
    if (params.symbol === "BTC/USD") {
      return HttpResponse.json(mockMarketMetadata)
    }
    return HttpResponse.json({ error: "Market not found" }, { status: 404 })
  }),

  http.get("*/api/orderbook/:symbol", ({ params }) => {
    if (params.symbol === "BTC/USD") {
      return HttpResponse.json(mockOrderBookSnapshot)
    }
    return HttpResponse.json({ error: "Symbol not found" }, { status: 404 })
  }),

  http.get("*/api/trades/:symbol", ({ params }) => {
    if (params.symbol === "BTC/USD") {
      return HttpResponse.json({ trades: mockRecentTrades })
    }
    return HttpResponse.json({ error: "Symbol not found" }, { status: 404 })
  }),

  http.get("*/api/account/:address", ({ params }) => {
    if (params.address === mockAccountSnapshot.account) {
      return HttpResponse.json(mockAccountSnapshot)
    }
    return HttpResponse.json({ error: "Account not found" }, { status: 404 })
  }),
]
