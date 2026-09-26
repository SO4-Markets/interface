import { useEffect, useState } from "react"
import { marketSubscriptionManager, applyDelta, buildLevels } from "../lib/market-data-stream"

export { applyDelta, buildLevels }

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
