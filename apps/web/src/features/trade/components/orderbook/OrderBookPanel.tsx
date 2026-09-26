import { useOrderBook } from "../../hooks/useOrderBook"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
import { RecentTradesTape } from "./RecentTradesTape"
import { DepthChart } from "./DepthChart"

type Props = {
  symbol: string | undefined
}

export function OrderBookPanel({ symbol }: Props) {
  const orderbookView = useChartPreferencesStore((s) => s.orderbookView)
  const setOrderbookView = useChartPreferencesStore((s) => s.setOrderbookView)
  const { bids, asks, status, isLoading } = useOrderBook(symbol)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Panel Header Tabs ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOrderbookView("book")}
            className={`rounded px-2 py-1 font-mono text-xs font-semibold transition-colors ${
              orderbookView === "book"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-selected={orderbookView === "book"}
            role="tab"
          >
            Order Book
          </button>
          <button
            type="button"
            onClick={() => setOrderbookView("trades")}
            className={`rounded px-2 py-1 font-mono text-xs font-semibold transition-colors ${
              orderbookView === "trades"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-selected={orderbookView === "trades"}
            role="tab"
          >
            Trades
          </button>
          <button
            type="button"
            onClick={() => setOrderbookView("chart")}
            className={`rounded px-2 py-1 font-mono text-xs font-semibold transition-colors ${
              orderbookView === "chart"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-selected={orderbookView === "chart"}
            role="tab"
          >
            Depth Chart
          </button>
        </div>
        <span className="text-xs text-muted-foreground">Reference Data</span>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1">
        {orderbookView === "book" ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground h-full">
            Executable order-book depth is unavailable until a verified matching source is connected.
          </div>
        ) : orderbookView === "trades" ? (
          <RecentTradesTape symbol={symbol} />
        ) : (
          <DepthChart symbol={symbol} bids={bids} asks={asks} isLoading={isLoading} status={status} />
        )}
      </div>
    </div>
  )
}
