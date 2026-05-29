import { useEffect, useRef } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { useTradeState } from "../hooks/useTradeState"
import { useOrderEventPolling } from "../hooks/useOrderEventPolling"
import { Navbar } from "../../../ui/Navbar"
import { TVChart } from "./chart/TVChart"
import { TradePanel } from "./trade-panel/TradePanel"
import { BottomTabs } from "./positions/BottomTabs"
import { CircuitBreakerBanner } from "./CircuitBreakerBanner"

const tradeRoute = getRouteApi("/trade")

export function TradePage() {
  const trade = useTradeState()
  const { setToTokenAddress, setTradeType } = trade

  useOrderEventPolling()

  // Pre-fill the form from a shared deeplink (e.g. /trade?market=BTC&type=long).
  const search = tradeRoute.useSearch()
  const appliedDeeplink = useRef(false)
  useEffect(() => {
    if (appliedDeeplink.current) return
    if (!search.market && !search.type) return
    appliedDeeplink.current = true
    if (search.market) setToTokenAddress(search.market)
    if (search.type) setTradeType(search.type === "long" ? "Long" : "Short")
  }, [search.market, search.type, setToTokenAddress, setTradeType])

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <Navbar variant="app" />
      <CircuitBreakerBanner symbol={trade.toTokenAddress} />
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
