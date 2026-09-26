import { useEffect, useState } from "react"
import type { OhlcBar } from "../lib/oracle"
import { marketSubscriptionManager } from "../lib/market-data-stream"

/**
 * Real-time bar feed for the chart.
 *
 * Consumes from the centralized marketSubscriptionManager so connection,
 * polling fallback, and timer resources are shared across chart and other consumers.
 */
export function useLiveBar(symbol: string | undefined, period: string): OhlcBar | null {
  const [liveBar, setLiveBar] = useState<OhlcBar | null>(() => {
    if (!symbol) return null
    return marketSubscriptionManager.getOrCreate(symbol).getLiveBar(period)
  })

  useEffect(() => {
    if (!symbol) {
      setLiveBar(null)
      return
    }

    const shared = marketSubscriptionManager.getOrCreate(symbol)
    const unsubscribe = shared.subscribeLiveBar(period, (bar) => {
      setLiveBar(bar)
    })

    return () => {
      unsubscribe()
    }
  }, [symbol, period])

  return liveBar
}
