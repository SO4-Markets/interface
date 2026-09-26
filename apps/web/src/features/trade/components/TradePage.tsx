import { useEffect, useRef, useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { AppShell } from "@workspace/ui/components/app-shell"
import { Button } from "@workspace/ui/components/button"
import { ResizeHandle } from "@workspace/ui/components/resize-handle"
import { cn } from "@workspace/ui/lib/utils"
import { useTradeState } from "../hooks/useTradeState"
import { useOrderEventPolling } from "../hooks/useOrderEventPolling"
import { useBoundedChartHeight } from "../hooks/useBoundedChartHeight"
import { useLayoutPreferencesStore } from "../store/layout-preferences-store"
import { Navbar } from "../../../ui/Navbar"
import { TVChart } from "./chart/TVChart"
import { TradePanel } from "./trade-panel/TradePanel"
import { BottomTabs } from "./positions/BottomTabs"
import { CircuitBreakerBanner } from "./CircuitBreakerBanner"
import { PanelErrorBoundary } from "./PanelErrorBoundary"
import { MobileTradeNav,  mobileViewClassName } from "./MobileTradeNav"
import { OrderBookPanel } from "./orderbook/OrderBookPanel"
import type {MobileTradeView} from "./MobileTradeNav";
import { saveReferralCode } from "@/lib/contracts"
import { useAppFocusRecovery } from "@/shared/hooks/useAppFocusRecovery"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

const tradeRoute = getRouteApi("/trade")

export function TradePage() {
  const trade = useTradeState()
  const { setToTokenAddress, setTradeType } = trade
  const account = useWalletStore((state) => state.address)

  useOrderEventPolling()

  // OB-114: Pause/reduce non-essential work when hidden or offline; revalidate
  // active market and account data on return to prevent stale execution estimates.
  useAppFocusRecovery({ account })

  // Pre-fill the form from a shared deeplink (e.g. /trade?market=BTC&type=long).
  const search = tradeRoute.useSearch()
  const navigate = tradeRoute.useNavigate()
  const [activePanel, setActivePanel] = useState<"positions" | "orders" | "history" | "trades" | "claims">(
    search.panel ?? "positions"
  )
  const appliedDeeplink = useRef(false)
  useEffect(() => {
    if (appliedDeeplink.current) return
    if (!search.market && !search.type) return
    appliedDeeplink.current = true
    if (search.market) setToTokenAddress(search.market)
    if (search.type) setTradeType(search.type === "long" ? "Long" : "Short")
  }, [search.market, search.type, setToTokenAddress, setTradeType])

  useEffect(() => {
    if (!search.ref) return
    const normalized = search.ref.toUpperCase().trim()
    if (!normalized) return
    saveReferralCode(normalized)
  }, [search.ref])

  useEffect(() => setActivePanel(search.panel ?? "positions"), [search.panel])

  function handlePanelChange(panel: "positions" | "orders" | "history" | "trades" | "claims") {
    setActivePanel(panel)
    void navigate({ search: (previous) => ({ ...previous, panel }) })
  }

  // ── Desktop workspace resizing (OB-038) ─────────────────────────────────
  const chartRowRef = useRef<HTMLDivElement>(null)
  const {
    chartRowHeight,
    bookWidth,
    tradePanelWidth,
    setChartRowHeight,
    setBookWidth,
    setTradePanelWidth,
    resetLayout,
  } = useLayoutPreferencesStore()
  const boundedChartRowHeight = useBoundedChartHeight(chartRowRef, chartRowHeight)

  // ── Mobile chart/book/trade navigation (OB-037) ─────────────────────────
  const [mobileView, setMobileView] = useState<MobileTradeView>("chart")

  return (
    <AppShell
      variant="full"
      navbar={<Navbar variant="app" />}
      banner={<CircuitBreakerBanner symbol={trade.toTokenAddress} />}
      className="overflow-hidden"
    >
      {/* Main layout: stacked mobile, stacked-with-tabs tablet, side-by-side desktop */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:px-4 lg:flex-row lg:px-6">
        {/* ── Left: Chart + Book row, Bottom Tabs below ──────────────── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={chartRowRef}
            className="flex min-h-0 flex-1 flex-col md:flex-none md:h-[var(--chart-row-height)] md:flex-row lg:flex-none lg:h-[var(--chart-row-height)] lg:flex-row"
            style={{ ["--chart-row-height" as string]: `${boundedChartRowHeight}px` }}
          >
            {/* Chart */}
            <div
              id="mobile-trade-view-chart"
              className={cn("min-h-0 min-w-0 flex-1 flex-col", mobileViewClassName("chart", mobileView))}
            >
              <PanelErrorBoundary panel="chart">
                <TVChart symbol={trade.toTokenAddress} onSelectToken={trade.setToTokenAddress} />
              </PanelErrorBoundary>
            </div>

            <ResizeHandle
              orientation="vertical"
              label="Resize market depth panel width"
              value={bookWidth}
              min={220}
              max={420}
              onChange={setBookWidth}
              onReset={resetLayout}
              className="hidden md:block"
            />

            {/* Market depth / order book panel — tabs: Order Book + Trades tape */}
            <aside
              id="mobile-trade-view-book"
              aria-label="Order book depth"
              className={cn(
                "min-h-40 w-full flex-col overflow-hidden border-t border-border md:min-h-0 md:w-[var(--book-width)] md:border-t-0 md:border-inline-start lg:min-h-0 lg:w-[var(--book-width)] lg:border-t-0 lg:border-inline-start",
                mobileViewClassName("book", mobileView)
              )}
              style={{ ["--book-width" as string]: `${bookWidth}px` }}
            >
              <PanelErrorBoundary panel="market depth">
                <OrderBookPanel symbol={trade.toTokenAddress} />
              </PanelErrorBoundary>
            </aside>
          </div>

          <ResizeHandle
            orientation="horizontal"
            label="Resize chart and book row height"
            value={boundedChartRowHeight}
            min={240}
            max={900}
            onChange={setChartRowHeight}
            onReset={resetLayout}
            className="hidden md:block"
          />

          {/* Bottom tabs/panels: Positions / Orders / Trades / Claims */}
          <div
            id="mobile-trade-view-positions"
            className={cn(
              "min-h-0 flex-1 flex-col overflow-auto border-t border-border md:border-t-0 md:hidden lg:flex lg:border-t-0",
              mobileViewClassName("positions", mobileView)
            )}
          >
            <PanelErrorBoundary panel="positions and orders">
              <BottomTabs
                value={activePanel}
                onValueChange={handlePanelChange}
                onSelectPosition={(pos) =>
                  trade.setActivePosition({
                    isLong: pos.isLong,
                    marketAddress: pos.marketAddress,
                    indexToken: pos.indexToken,
                    collateralToken: pos.collateralToken,
                  })
                }
              />
            </PanelErrorBoundary>
          </div>
        </div>

        <ResizeHandle
          orientation="vertical"
          label="Resize trade panel width"
          value={tradePanelWidth}
          min={280}
          max={480}
          onChange={setTradePanelWidth}
          onReset={resetLayout}
          className="hidden md:block"
        />

        {/* ── Right: Trade Panel (tablet: overlay, desktop: side panel) ─── */}
        <div
          id="mobile-trade-view-trade"
          className={cn(
            "w-full min-h-0 flex-col overflow-x-hidden overflow-y-auto border-t border-border md:w-[var(--trade-panel-width)] md:border-t-0 md:border-inline-start md:shrink-0 lg:w-[var(--trade-panel-width)] lg:border-t-0 lg:border-inline-start lg:shrink-0",
            mobileViewClassName("trade", mobileView)
          )}
          style={{ ["--trade-panel-width" as string]: `${tradePanelWidth}px` }}
        >
          <PanelErrorBoundary panel="order ticket">
            <TradePanel trade={trade} />
          </PanelErrorBoundary>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-1.5 max-md:hidden">
        <Button variant="ghost" size="sm" onClick={resetLayout}>
          Reset layout
        </Button>
      </div>

      {/* Show mobile/tablet nav only on md and below; tablet shows chart+book + trade/positions tabs */}
      <MobileTradeNav active={mobileView} onChange={setMobileView} className="md:hidden" />
    </AppShell>
  )
}
