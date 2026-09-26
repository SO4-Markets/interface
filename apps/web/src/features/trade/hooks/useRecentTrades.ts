import { useEffect, useRef, useState } from "react"
import { BINANCE_SYMBOL } from "../lib/oracle"
import { deriveSourceHealth } from "./useSourceHealth"
import type { SourceHealth } from "./useSourceHealth"

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
  status: "connecting" | "connected" | "disconnected" | "error"
  error: Error | null
  isLoading: boolean
  sourceHealth: SourceHealth    // OB-058: comprehensive health tracking
}

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws"
const BINANCE_REST_BASE = "https://api.binance.com"
const MAX_TRADES = 50

/**
 * Deduplicate array of trades by unique `id`, sort deterministically (newest timestamp first),
 * and bound to MAX_TRADES rows.
 */
export function deduplicateAndSortTrades(trades: Array<TradeItem>, maxRows = MAX_TRADES): Array<TradeItem> {
  const map = new Map<string, TradeItem>()
  for (const t of trades) {
    if (!t.id || typeof t.price !== "number" || typeof t.qty !== "number") continue
    if (!Number.isFinite(t.price) || t.price <= 0 || !Number.isFinite(t.qty) || t.qty <= 0) continue
    if (!Number.isFinite(t.time) || t.time <= 0) continue
    // Key by string id
    map.set(String(t.id), t)
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time
    return String(b.id).localeCompare(String(a.id))
  })

  return sorted.slice(0, maxRows)
}

type BinanceTradeMsg = {
  e?: string
  E?: number
  s?: string
  t?: number
  p?: string
  q?: string
  m?: boolean // is buyer market maker?
}

type BinanceRestTrade = {
  id: number
  price: string
  qty: string
  time: number
  isBuyerMaker?: boolean
}

export function useRecentTrades(symbol: string | undefined): UseRecentTradesResult {
  const [trades, setTrades] = useState<Array<TradeItem>>([])
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting")
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [sourceHealth, setSourceHealth] = useState<SourceHealth>({
    status: "initial-load",
    lastUpdateTime: null,
    staleDuration: null,
    reconnectAttempt: 0,
    isExecutable: false,
    message: "Connecting to trade feed…",
  })

  const wsRef = useRef<WebSocket | null>(null)
  // OB-058: track reconnect attempts and last data timestamp
  const reconnectAttemptRef = useRef(0)
  const lastDataTimeRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    setTrades([])
    setIsLoading(true)
    setError(null)
    setStatus("connecting")

    if (!symbol) {
      const emptyHealth = deriveSourceHealth(
        { status: "disconnected", hasData: false, lastDataTime: null },
        Date.now(),
        0
      )
      setSourceHealth(emptyHealth)
      setIsLoading(false)
      setStatus("disconnected")
      return () => { mounted = false }
    }

    reconnectAttemptRef.current += 1
    const initialHealth = deriveSourceHealth(
      { status: "connecting", hasData: false, lastDataTime: lastDataTimeRef.current },
      Date.now(),
      reconnectAttemptRef.current
    )
    setSourceHealth(initialHealth)

    const binanceSym = BINANCE_SYMBOL[symbol] ?? symbol.toUpperCase() + "USDT"
    const lowerSym = binanceSym.toLowerCase()

    // ── Fetch initial REST snapshot ─────────────────────────────────────────
    async function fetchSnapshot() {
      try {
        const res = await fetch(`${BINANCE_REST_BASE}/api/v3/trades?symbol=${binanceSym}&limit=${MAX_TRADES}`)
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
        
        // OB-058: Update health after REST snapshot
        lastDataTimeRef.current = Date.now()
        const health = deriveSourceHealth(
          { status: "connecting", hasData: parsed.length > 0, lastDataTime: lastDataTimeRef.current },
          Date.now(),
          reconnectAttemptRef.current
        )
        setSourceHealth(health)
      } catch {
        if (!mounted) return
        setIsLoading(false)
        // Non-fatal, live WS stream will fill trades if REST fails
      }
    }

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
          
          // OB-058: Update health on connection
          reconnectAttemptRef.current = 0
          const health = deriveSourceHealth(
            { status: "connected", hasData: true, lastDataTime: lastDataTimeRef.current },
            Date.now(),
            0
          )
          setSourceHealth(health)
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
            
            // OB-058: Update health on each message
            lastDataTimeRef.current = Date.now()
            const health = deriveSourceHealth(
              { status: "connected", hasData: true, lastDataTime: lastDataTimeRef.current },
              Date.now(),
              0
            )
            setSourceHealth(health)
          } catch {
            /* ignore malformed message */
          }
        }

        ws.onerror = () => {
          if (!mounted) return
          setStatus("error")
          setError(new Error("Trade feed connection error"))
          
          // OB-058: Update health on error
          const health = deriveSourceHealth(
            { status: "error", hasData: true, lastDataTime: lastDataTimeRef.current },
            Date.now(),
            reconnectAttemptRef.current
          )
          setSourceHealth(health)
        }

        ws.onclose = () => {
          if (!mounted) return
          setStatus("disconnected")
          
          // OB-058: Update health on disconnect
          const health = deriveSourceHealth(
            { status: "disconnected", hasData: true, lastDataTime: lastDataTimeRef.current },
            Date.now(),
            reconnectAttemptRef.current
          )
          setSourceHealth(health)
        }
      } catch (err) {
        setStatus("disconnected")
        setError(err instanceof Error ? err : new Error("Failed to connect WS"))
      }
    }

    void fetchSnapshot()
    connectWs()

    return () => {
      mounted = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [symbol])

  return { trades, status, error, isLoading, sourceHealth }
}
