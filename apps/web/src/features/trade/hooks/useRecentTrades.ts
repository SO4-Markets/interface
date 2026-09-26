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
    if (!t.id || typeof t.price !== "number" || typeof t.qty !== "number") continue
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
  const [trades, setTrades] = useState<Array<TradeItem>>([])
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting")
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    setTrades([])
    setIsLoading(true)
    setError(null)
    setStatus("connecting")

    if (!symbol) {
      setIsLoading(false)
      setStatus("disconnected")
      return () => { mounted = false }
    }

    const binanceSym = BINANCE_SYMBOL[symbol] ?? symbol.toUpperCase() + "USDT"
    const lowerSym = binanceSym.toLowerCase()

    // ── Fetch initial REST snapshot ─────────────────────────────────────────
    async function fetchSnapshot() {
      try {
        const res = await fetch(
          `${BINANCE_REST_BASE}/api/v3/trades?symbol=${binanceSym}&limit=${MAX_TRADES}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw = (await res.json()) as Array<BinanceRestTrade>
        if (!mounted) return

        const parsed: Array<TradeItem> = raw.map((item) => ({
          id: String(item.id),
          price: parseFloat(item.price),
          qty: parseFloat(item.qty),
          time: item.time,
          side: typeof item.isBuyerMaker === "boolean" ? (item.isBuyerMaker ? "sell" : "buy") : "unknown",
          venue: "Binance Reference",
        }))

        setTrades((prev) => deduplicateAndSortTrades([...parsed, ...prev]))
        setIsLoading(false)
      } catch {
        if (!mounted) return
        setIsLoading(false)
        // Non-fatal, live WS stream will fill trades if REST fails
      }
    }
    const shared = marketSubscriptionManager.getOrCreate(symbol)
    return shared.getTradesResult()
  })

    // ── Connect WebSocket live feed ──────────────────────────────────────────
    function connectWs() {
      if (!mounted) return
      try {
        const url = `${BINANCE_WS_BASE}/${lowerSym}@trade`
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted) return
          setStatus("connected")
          setError(null)
        }

        ws.onmessage = (evt: MessageEvent) => {
          if (!mounted) return
          try {
            const data = JSON.parse(evt.data as string) as BinanceTradeMsg
            if (!data.p || !data.q || !data.t) return

            const newTrade: TradeItem = {
              id: String(data.t),
              price: parseFloat(data.p),
              qty: parseFloat(data.q),
              time: data.E || Date.now(),
              side: typeof data.m === "boolean" ? (data.m ? "sell" : "buy") : "unknown",
              venue: "Binance Reference",
            }

            setTrades((prev) => deduplicateAndSortTrades([newTrade, ...prev]))
            setIsLoading(false)
          } catch {
            /* ignore malformed message */
          }
        }

        ws.onerror = () => {
          if (!mounted) return
          setStatus("error")
          setError(new Error("Trade feed connection error"))
        }

        ws.onclose = () => {
          if (!mounted) return
          setStatus("disconnected")
        }
      } catch (err) {
        setStatus("disconnected")
        setError(err instanceof Error ? err : new Error("Failed to connect WS"))
      }
    }

    const shared = marketSubscriptionManager.getOrCreate(symbol)
    const unsubscribe = shared.subscribeTrades((next) => {
      setResult(next)
    })

    return () => {
      mounted = false
      controller.abort()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [symbol])

  return result
}
