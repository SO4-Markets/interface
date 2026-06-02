import { createFileRoute } from "@tanstack/react-router"
import { TradePage } from "../features/trade/components/TradePage"

/** Shareable deeplink params, e.g. /trade?market=BTC&type=long */
export type TradeSearch = {
  market?: string
  type?: "long" | "short"
  ref?: string
}

export const Route = createFileRoute("/trade")({
  component: TradePage,
  validateSearch: (search: Record<string, unknown>): TradeSearch => ({
    market: typeof search.market === "string" ? search.market : undefined,
    type: search.type === "long" || search.type === "short" ? search.type : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
})
