import { useId, useRef } from "react"
import { useOrderBook } from "../../hooks/useOrderBook"
import { useSourceFreshness } from "../../hooks/useSourceFreshness"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
import { SourceHealthBadge } from "./SourceHealthBadge"
import { RecentTradesTape } from "./RecentTradesTape"
import { DepthChart } from "./DepthChart"
import { DepthPanel } from "./DepthPanel"
import type { BookLevel } from "../../lib/orderbook/book-reducer"
import type { MarketDisplayMetadata } from "../../lib/orderbook/display-prefs"
import type { SourceHealth } from "../../hooks/useSourceHealth"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import type { OrderbookView } from "../../store/chart-preferences-store"

const ORDERBOOK_TABS = [
  { view: "book", label: "Order Book" },
  { view: "trades", label: "Trades" },
  { view: "chart", label: "Depth Chart" },
] as const satisfies ReadonlyArray<{ view: OrderbookView; label: string }>

export type VerifiedDepth = {
  metadata: MarketDisplayMetadata
  bids: ReadonlyArray<BookLevel>
  asks: ReadonlyArray<BookLevel>
  revision: bigint
  rows: number
  health: SourceHealth
  actionable: boolean
}

type Props = {
  symbol: string | undefined
  /** Only authoritative venue depth may populate this; oracle/chart data cannot. */
  verifiedDepth?: VerifiedDepth
  activeMarketId?: string
  onSeedLimitPrice?: (selection: { marketId: string; side: "bid" | "ask"; price: string }) => void
}

export function OrderBookPanel({ symbol, verifiedDepth, activeMarketId, onSeedLimitPrice }: Props) {
  const orderbookView = useChartPreferencesStore((s) => s.orderbookView)
  const setOrderbookView = useChartPreferencesStore((s) => s.setOrderbookView)
  const { bids, asks, status, isLoading } = useOrderBook(symbol)
  const source = useSourceFreshness(symbol)

  const baseId = useId()
  const tabId = (view: OrderbookView) => `${baseId}-tab-${view}`
  const panelId = (view: OrderbookView) => `${baseId}-panel-${view}`
  const tabRefs = useRef<Map<OrderbookView, HTMLButtonElement>>(new Map())

  // APG tabs: the tablist is a single tab stop, and Left/Right (plus Home/End)
  // move between tabs. Without this the roving `tabIndex` below would strand
  // keyboard users on whichever tab happens to be selected.
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const current = ORDERBOOK_TABS.findIndex((t) => t.view === orderbookView)
    const last = ORDERBOOK_TABS.length - 1
    let next = current
    if (event.key === "ArrowLeft") next = current <= 0 ? last : current - 1
    else if (event.key === "ArrowRight") next = current >= last ? 0 : current + 1
    else if (event.key === "Home") next = 0
    else next = last

    const nextView = ORDERBOOK_TABS[next].view
    setOrderbookView(nextView)
    tabRefs.current.get(nextView)?.focus()
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Panel Header Tabs ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div
          role="tablist"
          aria-label="Order book view"
          onKeyDown={handleKeyDown}
          className="flex items-center gap-1"
        >
          {ORDERBOOK_TABS.map(({ view, label }) => {
            const isActive = orderbookView === view
            return (
              <button
                key={view}
                ref={(el) => {
                  if (el) tabRefs.current.set(view, el)
                  else tabRefs.current.delete(view)
                }}
                type="button"
                role="tab"
                id={tabId(view)}
                aria-selected={isActive}
                aria-controls={panelId(view)}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setOrderbookView(view)}
                className={`rounded px-2 py-1 font-mono text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          Reference Data
          {source ? <SourceHealthBadge health={source.health} /> : null}
        </span>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      {/* APG: a tabpanel is a tab stop only when it holds nothing focusable.
          The trades tape owns a focusable scroll region, so making the panel
          focusable too would just add a second, redundant stop. */}
      <div
        role="tabpanel"
        id={panelId(orderbookView)}
        aria-labelledby={tabId(orderbookView)}
        tabIndex={orderbookView === "trades" ? undefined : 0}
        className="min-h-0 flex-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {orderbookView === "book" ? (
          verifiedDepth && verifiedDepth.actionable && verifiedDepth.health.isExecutable &&
          activeMarketId === verifiedDepth.metadata.marketId ? (
            <DepthPanel metadata={verifiedDepth.metadata} bids={verifiedDepth.bids}
              asks={verifiedDepth.asks} rows={verifiedDepth.rows} health={verifiedDepth.health}
              bookRevision={verifiedDepth.revision} feedActionable={verifiedDepth.actionable}
              activeMarketId={activeMarketId} onSeedLimitPrice={onSeedLimitPrice} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground h-full">
              Executable order-book depth is unavailable until a verified matching source is connected.
            </div>
          )
        ) : orderbookView === "trades" ? (
          <RecentTradesTape symbol={symbol} />
        ) : (
          <DepthChart symbol={symbol} bids={bids} asks={asks} isLoading={isLoading} status={status} />
        )}
      </div>
    </div>
  )
}
