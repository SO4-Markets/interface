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
    // ── Per-instance mounted flag ─────────────────────────────────────────
    // A plain local `let`, NOT a ref.  Each effect invocation gets its own
    // copy captured by closure, so the old effect's callbacks can never see
    // `mounted = true` after cleanup even if the new effect has already started.
    let mounted = true
    let usingPoll = false
    let gotFirstWsMessage = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let firstMsgTimeout: ReturnType<typeof setTimeout> | null = null

    setLiveBar(null)

    if (!symbol) return () => { mounted = false }

    const binanceSym = BINANCE_SYMBOL[symbol]
    const binancePeriod = BINANCE_PERIOD[period]

    // ── Polling fallback ────────────────────────────────────────────────────
    function startPolling() {
      if (usingPoll) return
      usingPoll = true

      async function tick() {
        if (!mounted) return
        if (!isHiddenRef.current) {
          try {
            const res = await fetchOracleCandles(symbol!, period, 1)
            if (res.candles.length > 0) setLiveBar(res.candles[res.candles.length - 1])
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
      if (!binanceSym || !binancePeriod || isHiddenRef.current) { startPolling(); return }

      const url = `${BINANCE_WS}/${binanceSym.toLowerCase()}@kline_${binancePeriod}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      // If no message arrives within 4 s, fall back to polling permanently
      firstMsgTimeout = setTimeout(() => {
        if (!gotFirstWsMessage && mounted) { ws.close(); startPolling() }
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
          const k = msg.k
          setLiveBar({
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          })
        } catch { /* malformed frame */ }
      }

      ws.onclose = () => {
        if (firstMsgTimeout) { clearTimeout(firstMsgTimeout); firstMsgTimeout = null }
        if (!mounted) return
        if (!gotFirstWsMessage) {
          startPolling()
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
