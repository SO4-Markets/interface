import { useEffect, useState } from "react"
import { marketSubscriptionManager } from "../lib/market-data-stream"

export type TradeSide = "buy" | "sell" | "unknown"

export type TradeItem = {
  id: string
  price: number
  qty: number
  time: number // ms Unix timestamp
  side: TradeSide
  venue: string
}

export type UseRecentTradesResult = {
  trades: Array<TradeItem>
  status: "connecting" | "connected" | "disconnected" | "error" | "polling"
  error: Error | null
  isLoading: boolean
}

const MAX_TRADES = 50

/**
 * Deduplicate array of trades by unique `id`, sort deterministically (newest timestamp first),
 * and bound to MAX_TRADES rows.
 */
export function deduplicateAndSortTrades(
  trades: Array<TradeItem>,
  maxRows = MAX_TRADES,
): Array<TradeItem> {
  const map = new Map<string, TradeItem>()
  for (const t of trades) {
    if (!t || !t.id || typeof t.price !== "number" || typeof t.qty !== "number") continue
    if (!Number.isFinite(t.price) || t.price <= 0 || !Number.isFinite(t.qty) || t.qty <= 0) continue
    if (!Number.isFinite(t.time) || t.time <= 0) continue
    map.set(String(t.id), t)
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time
    return String(b.id).localeCompare(String(a.id))
  })

  return sorted.slice(0, maxRows)
}

export function useRecentTrades(symbol: string | undefined): UseRecentTradesResult {
  const [result, setResult] = useState<UseRecentTradesResult>(() => {
    if (!symbol) {
      return {
        trades: [],
        status: "disconnected",
        error: null,
        isLoading: false,
      }
    }
    const shared = marketSubscriptionManager.getOrCreate(symbol)
    return shared.getTradesResult()
  })

  useEffect(() => {
    if (!symbol) {
      setResult({
        trades: [],
        status: "disconnected",
        error: null,
        isLoading: false,
      })
      return
    }

    const shared = marketSubscriptionManager.getOrCreate(symbol)
    const unsubscribe = shared.subscribeTrades((next) => {
      setResult(next)
    })

    return () => {
      unsubscribe()
    }
  }, [symbol])

  return result
}
