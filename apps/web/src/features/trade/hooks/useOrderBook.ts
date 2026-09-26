import { useEffect, useRef, useState } from "react"
import { BINANCE_SYMBOL } from "../lib/oracle"
import { deriveSourceHealth } from "./useSourceHealth"
import type { SourceHealth } from "./useSourceHealth"

export type OrderBookLevel = {
  price: number
  size: number
  total: number   // cumulative depth from top of side
  depth: number   // fraction 0–1 relative to max total on that side
}

export type OrderBookState = {
  bids: Array<OrderBookLevel>  // descending by price (best bid first)
  asks: Array<OrderBookLevel>  // ascending by price (best ask first)
  spread: number | null
  spreadPct: number | null
  midPrice: number | null
  status: "connecting" | "connected" | "disconnected" | "error"
  isLoading: boolean
  sourceHealth: SourceHealth    // OB-058: comprehensive health tracking
}

const BINANCE_REST = "https://api.binance.com"
const BINANCE_WS   = "wss://stream.binance.com:9443/ws"
const LEVELS       = 20  // rows each side

// ── internal book: map<priceString, sizeString> ──────────────────────────────

type RawBook = {
  bids: Map<string, string>
  asks: Map<string, string>
  lastUpdateId: number
}

// Exported for unit testing (OB-119): these are the pure, replayable pieces
// of book reconciliation — applying an ordered run of deltas must converge
// to the same final state regardless of how those deltas were batched into
// renders, since `schedulePublish()` only bounds how often this
// accumulated state is committed, never which deltas get applied to it.
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
    .sort((a, b) => ascending ? a[0] - b[0] : b[0] - a[0])
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

// ── hook ─────────────────────────────────────────────────────────────────────

export function useOrderBook(symbol: string | undefined): OrderBookState {
  const [state, setState] = useState<OrderBookState>({
    bids: [],
    asks: [],
    spread: null,
    spreadPct: null,
    midPrice: null,
    status: "connecting",
    isLoading: true,
    sourceHealth: {
      status: "initial-load",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connecting to market data feed…",
    },
  })

  // stable ref so WS handler can push without capturing stale closures
  const bookRef = useRef<RawBook>({
    bids: new Map(),
    asks: new Map(),
    lastUpdateId: 0,
  })

  // buffered WS events received before snapshot arrives
  const bufferRef    = useRef<Array<BinanceDiffMsg>>([])
  const snapshotDone = useRef(false)
  const wsRef        = useRef<WebSocket | null>(null)
  // OB-119: coalesces bursty WS deltas into at most one render per frame.
  // `bookRef` (the source of truth) is still mutated synchronously on every
  // message — nothing is dropped — this only bounds how often that
  // accumulated state is committed to React state.
  const publishFrame = useRef<number | null>(null)
  // OB-058: track reconnect attempts and last data timestamp for health
  const reconnectAttemptRef = useRef(0)
  const lastDataTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!symbol) {
      const emptyHealth = deriveSourceHealth(
        { status: "disconnected", hasData: false, lastDataTime: null },
        Date.now(),
        0
      )
      setState(s => ({ ...s, status: "disconnected", isLoading: false, sourceHealth: emptyHealth }))
      return
    }

    let mounted = true
    snapshotDone.current = false
    bufferRef.current    = []
    bookRef.current      = { bids: new Map(), asks: new Map(), lastUpdateId: 0 }
    reconnectAttemptRef.current += 1  // OB-058: track reconnect attempts

    const initialHealth = deriveSourceHealth(
      { status: "connecting", hasData: false, lastDataTime: lastDataTimeRef.current },
      Date.now(),
      reconnectAttemptRef.current
    )
    setState({
      bids: [], asks: [], spread: null, spreadPct: null,
      midPrice: null, status: "connecting", isLoading: true,
      sourceHealth: initialHealth,
    })

    const binanceSym = BINANCE_SYMBOL[symbol] ?? (symbol.toUpperCase() + "USDT")
    const lowerSym   = binanceSym.toLowerCase()

    // ── Flush buffer + snapshot into bookRef, then re-render ──────────────
    function flush() {
      if (!mounted) return
      const book = bookRef.current

      for (const msg of bufferRef.current) {
        // discard events older than the snapshot
        if (msg.u <= book.lastUpdateId) continue
        applyDelta(book.bids, msg.b)
        applyDelta(book.asks, msg.a)
      }
      bufferRef.current = []
      snapshotDone.current = true
      publish()
    }

    // OB-119: schedules a coalesced publish — at most one per animation
    // frame — instead of committing on every single WS message. Under a
    // burst of deltas, only the last-scheduled frame actually renders, and
    // it always reads the fully up-to-date `bookRef`, so the result is the
    // same final state as publishing on every message, just at a bounded
    // render frequency.
    function schedulePublish() {
      if (!mounted || publishFrame.current !== null) return
      publishFrame.current = requestAnimationFrame(() => {
        publishFrame.current = null
        publish()
      })
    }

    function publish() {
      if (!mounted) return
      const bids = buildLevels(bookRef.current.bids, false)
      const asks = buildLevels(bookRef.current.asks, true)
      const bestBid = bids[0] ? bids[0].price : null
      const bestAsk = asks[0] ? asks[0].price : null
      const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null
      const mid    = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null
      const pct    = spread !== null && mid !== null && mid > 0 ? (spread / mid) * 100 : null
      
      // OB-058: Update last data timestamp and derive source health
      lastDataTimeRef.current = Date.now()
      const hasData = bids.length > 0 || asks.length > 0
      const health = deriveSourceHealth(
        { status: "connected", hasData, lastDataTime: lastDataTimeRef.current },
        Date.now(),
        reconnectAttemptRef.current
      )
      
      setState({
        bids, asks,
        spread,
        spreadPct: pct,
        midPrice: mid,
        status: "connected",
        isLoading: false,
        sourceHealth: health,
      })
      
      // Reset reconnect counter on successful publish
      reconnectAttemptRef.current = 0
    }

    // ── REST snapshot ──────────────────────────────────────────────────────
    async function fetchSnapshot() {
      try {
        const res = await fetch(
          `${BINANCE_REST}/api/v3/depth?symbol=${binanceSym}&limit=${LEVELS * 2}`,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as BinanceSnapshot
        if (!mounted) return
        const book = bookRef.current
        book.lastUpdateId = data.lastUpdateId
        book.bids = new Map(data.bids)
        book.asks = new Map(data.asks)
        flush()
      } catch (err) {
        if (!mounted) return
        const health = deriveSourceHealth(
          { status: "error", hasData: false, lastDataTime: lastDataTimeRef.current },
          Date.now(),
          reconnectAttemptRef.current
        )
        setState(s => ({ ...s, isLoading: false, status: "error", sourceHealth: health }))
      }
    }

    // ── WebSocket diff stream ──────────────────────────────────────────────
    const ws = new WebSocket(`${BINANCE_WS}/${lowerSym}@depth@100ms`)
    wsRef.current = ws

    ws.onopen = () => { if (mounted) void fetchSnapshot() }

    ws.onmessage = (evt: MessageEvent) => {
      if (!mounted) return
      try {
        const msg = JSON.parse(evt.data as string) as BinanceDiffMsg
        if (snapshotDone.current) {
          applyDelta(bookRef.current.bids, msg.b)
          applyDelta(bookRef.current.asks, msg.a)
          // OB-119: use schedulePublish instead of immediate publish to coalesce
          // bursty updates into at most one render per animation frame
          schedulePublish()
        } else {
          bufferRef.current.push(msg)
        }
      } catch { /* ignore malformed */ }
    }

    ws.onerror = () => {
      if (mounted) {
        const hasData = bookRef.current.bids.size > 0 || bookRef.current.asks.size > 0
        const health = deriveSourceHealth(
          { status: "error", hasData, lastDataTime: lastDataTimeRef.current },
          Date.now(),
          reconnectAttemptRef.current
        )
        setState(s => ({ ...s, status: "error", isLoading: false, sourceHealth: health }))
      }
    }
    ws.onclose = () => {
      if (mounted) {
        const hasData = bookRef.current.bids.size > 0 || bookRef.current.asks.size > 0
        const health = deriveSourceHealth(
          { status: "disconnected", hasData, lastDataTime: lastDataTimeRef.current },
          Date.now(),
          reconnectAttemptRef.current
        )
        setState(s => ({ ...s, status: "disconnected", sourceHealth: health }))
      }
    }

    return () => {
      mounted = false
      if (publishFrame.current !== null) {
        cancelAnimationFrame(publishFrame.current)
        publishFrame.current = null
      }
      ws.close()
      wsRef.current = null
    }
  }, [symbol])

  return state
}

// ── Binance wire types ────────────────────────────────────────────────────────

type BinanceSnapshot = {
  lastUpdateId: number
  bids: Array<[string, string]>
  asks: Array<[string, string]>
}

type BinanceDiffMsg = {
  u: number   // final update id in event
  b: Array<[string, string]>
  a: Array<[string, string]>
}
