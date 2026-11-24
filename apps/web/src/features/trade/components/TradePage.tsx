import { useCallback, useEffect, useRef, useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { AppShell } from "@workspace/ui/components/app-shell"
import { Button } from "@workspace/ui/components/button"
import { ResizeHandle } from "@workspace/ui/components/resize-handle"
import { LiveRegion, useAnnouncer } from "@workspace/ui/components/live-region"
import { cn } from "@workspace/ui/lib/utils"
import { useTradeState } from "../hooks/useTradeState"
import { useOrderEventPolling } from "../hooks/useOrderEventPolling"
import { useBoundedChartHeight } from "../hooks/useBoundedChartHeight"
import { useLayoutPreferencesStore } from "../store/layout-preferences-store"
import { seedLimitTicketPrice } from "../lib/orderbook/seed-limit-ticket"
import { orderEventAnnouncement } from "../lib/trade-announcements"
import { Navbar } from "../../../ui/Navbar"
import { useWorkspaceShortcuts } from "../hooks/useWorkspaceShortcuts"
import { TVChart } from "./chart/TVChart"
import { TradePanel } from "./trade-panel/TradePanel"
import { BottomTabs } from "./positions/BottomTabs"
import { POSITION_SORT_COLUMNS } from "./positions/PositionsList"
import { CircuitBreakerBanner } from "./CircuitBreakerBanner"
import { PanelErrorBoundary } from "./PanelErrorBoundary"
import { MobileTradeNav,  mobileViewClassName } from "./MobileTradeNav"
import { OrderBookPanel } from "./orderbook/OrderBookPanel"
import { CommandPalette } from "./CommandPalette"
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp"
import { TradeWorkspaceTour } from "./TradeWorkspaceTour"
import type {MobileTradeView} from "./MobileTradeNav"
import type { SortState } from "@workspace/ui/components/data-table"
import { saveReferralCode } from "@/lib/contracts"
import { validateReferralCode } from "@/features/referrals/lib/referrals"
import { useAppFocusRecovery } from "@/shared/hooks/useAppFocusRecovery"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { useTheme } from "@/ui/theme-provider"
import { formatSortParam, parseSortParam } from "@/shared/lib/table-sort"

const tradeRoute = getRouteApi("/trade")

export function TradePage() {
  const trade = useTradeState()
  const { setToTokenAddress, setTradeType } = trade
  const account = useWalletStore((state) => state.address)

  // issue 956: fills land in the positions table without moving focus, so they
  // are also spoken. Polite — a fill is good news, not an interruption.
  const fillAnnouncer = useAnnouncer()
  const announceFill = fillAnnouncer.announce
  const handleAccountOrderEvent = useCallback(
    (name: Parameters<typeof orderEventAnnouncement>[0]) => {
      const message = orderEventAnnouncement(name)
      if (message) announceFill(message)
    },
    [announceFill],
  )
  useOrderEventPolling({ onAccountEvent: handleAccountOrderEvent })

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
    // Untrusted URL input: store only well-formed codes. The code is never
    // applied automatically; ApplyReferralCodePrompt asks the trader first.
    if (validateReferralCode(normalized) !== null) return
    saveReferralCode(normalized)
  }, [search.ref])

  useEffect(() => setActivePanel(search.panel ?? "positions"), [search.panel])

  function handlePanelChange(panel: "positions" | "orders" | "history" | "trades" | "claims") {
    setActivePanel(panel)
    void navigate({ search: (previous) => ({ ...previous, panel }) })
  }

  const positionsSort = parseSortParam(search.positionsSort, POSITION_SORT_COLUMNS)
  function handlePositionsSortChange(next: SortState | null) {
    void navigate({
      search: (previous) => ({ ...previous, positionsSort: formatSortParam(next) }),
      replace: true,
      resetScroll: false,
    })
  }

  // ── Desktop workspace resizing (OB-038) ─────────────────────────────────
  const chartRowRef = useRef<HTMLDivElement>(null)
  // The bound must come from the column that holds the chart row and the
  // bottom tabs. Measuring the chart row itself feeds its own (already
  // clamped) height back in, collapsing it to the minimum on every render.
  const chartColumnRef = useRef<HTMLDivElement>(null)
  const {
    chartRowHeight,
    bookWidth,
    tradePanelWidth,
    setChartRowHeight,
    setBookWidth,
    setTradePanelWidth,
    resetLayout,
  } = useLayoutPreferencesStore()
  const boundedChartRowHeight = useBoundedChartHeight(chartColumnRef, chartRowHeight)

  // ── Mobile chart/book/trade navigation (OB-037) ─────────────────────────
  const [mobileView, setMobileView] = useState<MobileTradeView>("chart")
  const [tourReplayKey, setTourReplayKey] = useState(0)

  const { setTheme, resolvedTheme } = useTheme()
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")

  // Register workspace navigation shortcuts (Ctrl/Cmd+1..4, M) and the
  // command palette / shortcuts-help triggers (⌘K, ?).
  useWorkspaceShortcuts({
    onFocusMarketSearch: () => {
      // Focuses the market selector once a ref is exposed by the chart.
    },
    onFocusChart: () => setMobileView("chart"),
    onFocusBook: () => setMobileView("book"),
    onFocusTrade: () => setMobileView("trade"),
    onFocusPositions: () => setMobileView("positions"),
  })

  return (
    <AppShell
      variant="full"
      navbar={<Navbar variant="app" />}
      banner={<CircuitBreakerBanner symbol={trade.toTokenAddress} />}
      className="h-svh overflow-hidden"
    >
      <LiveRegion
        message={fillAnnouncer.message}
        announcementKey={fillAnnouncer.announcementKey}
        data-testid="order-fill-announcer"
      />

      {/* Main layout: stacked mobile, stacked-with-tabs tablet, side-by-side desktop */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:px-4 lg:flex-row lg:px-6">
        {/* ── Left: Chart + Book row, Bottom Tabs below ──────────────── */}
        <div ref={chartColumnRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={chartRowRef}
            className="flex min-h-0 flex-1 flex-col md:flex-none md:h-[var(--chart-row-height)] md:flex-row lg:flex-none lg:h-[var(--chart-row-height)] lg:flex-row"
            style={{ ["--chart-row-height" as string]: `${boundedChartRowHeight}px` }}
          >
            {/* Chart */}
            <div
              id="mobile-trade-view-chart"
              className={cn("relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden", mobileViewClassName("chart", mobileView))}
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
                "min-h-40 w-full flex-col overflow-hidden border-t border-border md:min-h-0 md:w-[var(--book-width)] md:border-t-0 md:border-s lg:min-h-0 lg:w-[var(--book-width)] lg:border-t-0 lg:border-s",
                mobileViewClassName("book", mobileView)
              )}
              style={{ ["--book-width" as string]: `${bookWidth}px` }}
            >
              <PanelErrorBoundary panel="market depth">
                <OrderBookPanel symbol={trade.toTokenAddress}
                  activeMarketId={trade.marketAddress}
                  onSeedLimitPrice={(selection) => {
                    seedLimitTicketPrice({
                      selection,
                      currentMarketId: trade.marketAddress,
                      tradeMode: trade.tradeMode,
                      tradeType: trade.tradeType,
                      setTriggerPrice: trade.setTriggerPrice,
                    })
                  }}
                />
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
            data-tour-target="positions"
            className={cn(
              "min-h-0 flex-1 flex-col overflow-auto border-t border-border md:border-t-0",
              mobileViewClassName("positions", mobileView)
            )}
          >
            <PanelErrorBoundary panel="positions and orders">
              <BottomTabs
                value={activePanel}
                onValueChange={handlePanelChange}
                positionsSort={positionsSort}
                onPositionsSortChange={handlePositionsSortChange}
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
            "w-full min-h-0 flex-col overflow-x-auto overflow-y-auto border-t border-border md:w-[var(--trade-panel-width)] md:border-t-0 md:border-s md:shrink-0 lg:w-[var(--trade-panel-width)] lg:border-t-0 lg:border-s lg:shrink-0",
            mobileViewClassName("trade", mobileView)
          )}
          style={{ ["--trade-panel-width" as string]: `${tradePanelWidth}px` }}
        >
          <PanelErrorBoundary panel="order ticket">
            <TradePanel trade={trade} />
          </PanelErrorBoundary>
        </div>
      </div>

      {/* Workspace footer. Help lives here at every width so it never floats
          over panel controls; Reset layout only matters where the resize
          handles exist (md and up). */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-1.5">
        <KeyboardShortcutsHelp onStartTour={() => setTourReplayKey((key) => key + 1)} />
        <Button variant="ghost" size="sm" onClick={resetLayout} className="max-md:hidden">
          Reset layout
        </Button>
      </div>

      {/* Compact navigation covers every width where the full side-by-side layout does not fit. */}
      <MobileTradeNav active={mobileView} onChange={setMobileView} className="lg:hidden" />

      <CommandPalette
        onFocusMarketSearch={() => {
          // Market selector focus requires a ref exposed by the chart.
        }}
        onFocusChart={() => setMobileView("chart")}
        onFocusBook={() => setMobileView("book")}
        onFocusTrade={() => setMobileView("trade")}
        onFocusPositions={() => setMobileView("positions")}
        onToggleTheme={toggleTheme}
      />
      <TradeWorkspaceTour replayKey={tourReplayKey} onViewChange={setMobileView} />
    </AppShell>
  )
}
