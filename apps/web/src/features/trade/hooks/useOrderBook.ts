import { useEffect, useState } from "react"
import { marketSubscriptionManager } from "../lib/market-data-stream"

export type OrderBookLevel = {
  price: number
  size: number
  total: number // cumulative depth from top of side
  depth: number // fraction 0–1 relative to max total on that side
}

export type OrderBookState = {
  bids: Array<OrderBookLevel> // descending by price (best bid first)
  asks: Array<OrderBookLevel> // ascending by price (best ask first)
  spread: number | null
  spreadPct: number | null
  midPrice: number | null
  status: "connecting" | "connected" | "disconnected" | "error" | "polling"
  isLoading: boolean
}


const LEVELS = 20  // rows each side

// Exported for unit testing (OB-119): pure book reconciliation primitives.
export function applyDelta(map: Map<string, string>, entries: Array<[string, string]>) {
  for (const [price, size] of entries) {
    if (parseFloat(size) === 0) map.delete(price)
    else map.set(price, size)
  }
}

export function buildLevels(
  map: Map<string, string>,
  ascending: boolean,
): Array<OrderBookLevel> {
  const pairs = Array.from(map.entries())
    .map(([p, s]) => [parseFloat(p), parseFloat(s)] as [number, number])
    .filter(([, s]) => s > 0)
    .sort((a, b) => (ascending ? a[0] - b[0] : b[0] - a[0]))
    .slice(0, LEVELS)

  let running = 0
  const levels: Array<OrderBookLevel> = pairs.map(([price, size]) => {
    running += size
    return { price, size, total: running, depth: 0 }
  })

  const max = levels.at(-1)?.total ?? 1
  for (const l of levels) l.depth = l.total / max
  return levels
}

export function useOrderBook(symbol: string | undefined): OrderBookState {
  const [state, setState] = useState<OrderBookState>(() => {
    if (!symbol) {
      return {
        bids: [],
        asks: [],
        spread: null,
        spreadPct: null,
        midPrice: null,
        status: "disconnected",
        isLoading: false,
      }
    }
    const shared = marketSubscriptionManager.getOrCreate(symbol)
    return shared.getBookState()
  })

  useEffect(() => {
    if (!symbol) {
      setState({
        bids: [],
        asks: [],
        spread: null,
        spreadPct: null,
        midPrice: null,
        status: "disconnected",
        isLoading: false,
      })
      return
    }

    const shared = marketSubscriptionManager.getOrCreate(symbol)
    const unsubscribe = shared.subscribeBook((next) => {
      setState(next)
    })

    return () => {
      unsubscribe()
    }
  }, [symbol])

  return state
}
