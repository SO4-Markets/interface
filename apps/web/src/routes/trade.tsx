import { createFileRoute } from "@tanstack/react-router"
import { Suspense, lazy } from "react"
import { LoadingPage } from "../shared/components/LoadingPage"

// Lazy load the heavy trade page to reduce initial bundle
const TradePage = lazy(() =>
  import("../features/trade/components/TradePage").then((m) => ({
    default: m.TradePage,
  }))
)

/** Shareable deeplink params, e.g. /trade?market=BTC&type=long */
export type TradeSearch = {
  market?: string
  type?: "long" | "short"
  panel?: "positions" | "orders" | "history" | "trades" | "claims"
  ref?: string
}

export const Route = createFileRoute("/trade")({
  component: () => (
    <Suspense fallback={<LoadingPage />}>
      <TradePage />
    </Suspense>
  ),
  validateSearch: (search: Record<string, unknown>): TradeSearch => ({
    market: typeof search.market === "string" ? search.market : undefined,
    type: search.type === "long" || search.type === "short" ? search.type : undefined,
    panel:
      search.panel === "positions" ||
      search.panel === "orders" ||
      search.panel === "history" ||
      search.panel === "trades" ||
      search.panel === "claims"
        ? search.panel
        : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
})
