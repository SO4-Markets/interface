import { useTradeState } from "../hooks/useTradeState"
import { Navbar } from "../../../ui/Navbar"
import { TVChart } from "./chart/TVChart"
import { TradePanel } from "./trade-panel/TradePanel"
import { BottomTabs } from "./positions/BottomTabs"

export function TradePage() {
  const trade = useTradeState()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <Navbar variant="app" />
      <div className="flex min-h-0 flex-1 lg:px-6">
        {/* ── Left: Chart + Bottom Tabs ──────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Chart takes the majority of height */}
          <div className="min-h-0 flex-1">
            <TVChart symbol={trade.toTokenAddress} onSelectToken={trade.setToTokenAddress} />
          </div>

          {/* Bottom tabs: Positions / Orders / Trades / Claims */}
          <div className="h-64 shrink-0 overflow-auto border-t border-border">
            <BottomTabs
              onSelectPosition={(pos) =>
                trade.setActivePosition({
                  isLong: pos.isLong,
                  marketAddress: pos.marketAddress,
                  indexToken: pos.indexToken,
                  collateralToken: pos.collateralToken,
                })
              }
            />
          </div>
        </div>

        {/* ── Right: Trade Panel ─────────────────────────────────────── */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border">
          <TradePanel />
        </div>
      </div>
    </div>
  )
}
