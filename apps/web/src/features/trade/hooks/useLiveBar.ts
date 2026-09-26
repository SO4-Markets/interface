import { useEffect, useRef, useState } from "react"
import { BINANCE_PERIOD, BINANCE_SYMBOL, fetchOracleCandles } from "../lib/oracle"
import { parseStreamBar } from "../lib/bar-reconciliation"
import type { LiveBarUpdate } from "../lib/bar-reconciliation"

type BinanceKlineMsg = {
  e: "kline"
  k: {
    t: number    // kline open time (ms)
    o: string
    h: string
    l: string
    c: string
    v: string
  }
}

const BINANCE_WS = "wss://stream.binance.com:9443/ws"
const POLL_MS = 1500
const RECONNECT_MS = 2000

/**
 * Real-time bar feed for the chart.
 *
 * Primary:  Binance WebSocket (@kline stream) — updates within ~200 ms of each trade.
 * Fallback: GMX oracle polled every 1.5 s (auto-activates if WS fails within 4 s).
 *
 * Uses a per-effect `mounted` closure variable (not a shared ref) so that
 * when symbol/period changes, the old effect's callbacks are silenced immediately
 * and cannot race with the new effect instance.
 */
export function useLiveBar(symbol: string | undefined, period: string): LiveBarUpdate | null {
  const [liveBar, setLiveBar] = useState<LiveBarUpdate | null>(null)

  // These refs are fine to share — they hold the *current* WS handle and poll timer
  // so cleanup can reach them from the returned teardown function.
  const wsRef = useRef<WebSocket | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHiddenRef = useRef(false)

  useEffect(() => {
    // ── Per-instance mounted flag ─────────────────────────────────────────
    // A plain local `let`, NOT a ref.  Each effect invocation gets its own
    // copy captured by closure, so the old effect's callbacks can never see
    // `mounted = true` after cleanup even if the new effect has already started.
    let mounted = true
    let usingPoll = false
    let gotFirstWsMessage = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let firstMsgTimeout: ReturnType<typeof setTimeout> | null = null
    let hasConnected = false

    setLiveBar(null)

    if (!symbol) return () => { mounted = false }

    const binanceSym = BINANCE_SYMBOL[symbol]
    const binancePeriod = BINANCE_PERIOD[period]

    // ── Polling fallback ────────────────────────────────────────────────────
    function startPolling(backfill = false) {
      if (usingPoll) return
      usingPoll = true
      let firstPoll = true

      async function tick() {
        if (!mounted) return
        if (!isHiddenRef.current) {
          try {
            const limit = firstPoll && backfill ? 3 : 1
            const bars = await fetchOracleCandles(symbol!, period, limit)
            if (bars.length > 0) {
              setLiveBar({
                current: bars[bars.length - 1],
                bars,
                source: firstPoll && backfill ? "backfill" : "poll",
              })
            }
            firstPoll = false
          } catch { /* silent retry */ }
        }
        pollTimerRef.current = setTimeout(tick, POLL_MS)
      }

      pollTimerRef.current = setTimeout(tick, POLL_MS)
    }

    function stopPolling() {
      usingPoll = false
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    }

    // ── WebSocket ──────────────────────────────────────────────────────────
    function connect() {
      if (!binanceSym || !binancePeriod || isHiddenRef.current) { startPolling(true); return }

      const url = `${BINANCE_WS}/${binanceSym.toLowerCase()}@kline_${binancePeriod}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      // If no message arrives within 4 s, fall back to polling permanently
      firstMsgTimeout = setTimeout(() => {
        if (!gotFirstWsMessage && mounted) { ws.close(); startPolling(true) }
      }, 4000)

      ws.onmessage = (evt: MessageEvent) => {
        if (!mounted) return
        if (!gotFirstWsMessage) {
          gotFirstWsMessage = true
          if (firstMsgTimeout) { clearTimeout(firstMsgTimeout); firstMsgTimeout = null }
          stopPolling()
        }
        if (isHiddenRef.current) return
        try {
          const msg = JSON.parse(evt.data as string) as BinanceKlineMsg
          const bar = parseStreamBar(msg.k, period)
          if (bar) setLiveBar({ current: bar, bars: [bar], source: "stream" })
        } catch { /* malformed frame */ }
      }

      ws.onopen = () => {
        if (!hasConnected) {
          hasConnected = true
          return
        }
        // Reconnects may miss one or more interval boundaries. Fetch a small
        // overlap from the selected historical source before applying stream data.
        void fetchOracleCandles(symbol!, period, 3).then((bars) => {
          if (mounted && bars.length > 0) {
            setLiveBar({ current: bars[bars.length - 1], bars, source: "backfill" })
          }
        }).catch(() => undefined)
      }

      ws.onclose = () => {
        if (firstMsgTimeout) { clearTimeout(firstMsgTimeout); firstMsgTimeout = null }
        if (!mounted) return
        if (!gotFirstWsMessage) {
          startPolling(true)
        } else {
          gotFirstWsMessage = false
          if (!isHiddenRef.current) reconnectTimer = setTimeout(connect, RECONNECT_MS)
        }
      }

      ws.onerror = () => ws.close()
    }

    // ── Tab visibility ────────────────────────────────────────────────────
    function handleVisibility() {
      isHiddenRef.current = document.visibilityState === "hidden"
      if (isHiddenRef.current) {
        wsRef.current?.close(); wsRef.current = null
        stopPolling()
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      } else {
        usingPoll = false; gotFirstWsMessage = false
        connect()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    connect()

    return () => {
      mounted = false
      document.removeEventListener("visibilitychange", handleVisibility)
      wsRef.current?.close(); wsRef.current = null
      stopPolling()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (firstMsgTimeout) clearTimeout(firstMsgTimeout)
    }
  }, [symbol, period])

  return liveBar
}
