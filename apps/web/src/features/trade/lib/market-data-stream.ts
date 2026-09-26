import { BINANCE_PERIOD, BINANCE_SYMBOL, fetchOracleCandles, type OhlcBar } from "./oracle"
import {
  DEFAULT_FRESHNESS_POLICY,
  createTelemetry,
  deriveFreshness,
  recordMalformed,
  recordMessage,
  recordSnapshot,
  recordValidUpdate,
  resetSnapshot,
  toSourceHealth,
} from "./source-freshness"
import type { FeedTelemetry, FeedTransport, FreshnessResult } from "./source-freshness"
import type { OrderBookLevel, OrderBookState } from "../hooks/useOrderBook"
import type { TradeItem, UseRecentTradesResult } from "../hooks/useRecentTrades"
import { deduplicateAndSortTrades } from "../hooks/useRecentTrades"
import type { SourceHealth } from "../hooks/useSourceHealth"

export type StreamStatus = "connecting" | "connected" | "polling" | "disconnected" | "error"

const BINANCE_REST_BASE = "https://api.binance.com"
const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws"
const LEVELS = 20
const MAX_TRADES = 50
const FALLBACK_POLL_INTERVAL_MS = 2000
const WS_CONNECT_TIMEOUT_MS = 4000

// OB-113: Reconnect backoff with jitter — exponential from 1 s up to 30 s cap.
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000
const RECONNECT_JITTER_RATIO = 0.25
// OB-113: Heartbeat — Binance sends a ping/pong or a message roughly every
// 3 s when data is flowing. We tolerate 20 s of silence before declaring a
// missed heartbeat and tearing down the WebSocket.
const HEARTBEAT_TIMEOUT_MS = 20_000

type RawBook = {
  bids: Map<string, string>
  asks: Map<string, string>
  lastUpdateId: number
}

/** A depth frame must carry both sides as arrays and a numeric revision to be applied. */
export function isValidDepthMsg(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const m = data as { b?: unknown; a?: unknown; u?: unknown }
  return Array.isArray(m.b) && Array.isArray(m.a) && typeof m.u === "number" && Number.isFinite(m.u)
}

export function applyDelta(map: Map<string, string>, entries: Array<[string, string]>) {
  for (const [price, size] of entries) {
    if (parseFloat(size) === 0) {
      map.delete(price)
    } else {
      map.set(price, size)
    }
  }
}

export function buildLevels(map: Map<string, string>, ascending: boolean): Array<OrderBookLevel> {
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

type BinanceDiffMsg = {
  e?: string
  /** Provider event time (ms since epoch), when present. */
  E?: number
  u: number
  b: Array<[string, string]>
  a: Array<[string, string]>
}

type BinanceTradeMsg = {
  e?: string
  E?: number
  s?: string
  t?: number
  p?: string
  q?: string
  m?: boolean
}

type BinanceKlineMsg = {
  e: "kline"
  k: {
    t: number
    o: string
    h: string
    l: string
    c: string
  }
}

type BinanceRestTrade = {
  id: number
  price: string
  qty: string
  time: number
  isBuyerMaker?: boolean
}

type BinanceSnapshot = {
  lastUpdateId: number
  bids: Array<[string, string]>
  asks: Array<[string, string]>
}

class SharedMarketSubscription {
  private symbol: string
  private binanceSym: string
  private lowerSym: string

  private ws: WebSocket | null = null
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private wsTimeout: ReturnType<typeof setTimeout> | null = null
  private isDestroyed = false

  // OB-113: Reconnect backoff state.
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  // OB-113: Heartbeat — reset whenever any message is received from the WS.
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null

  private bookSubscribers = new Set<(state: OrderBookState) => void>()
  private tradesSubscribers = new Set<(result: UseRecentTradesResult) => void>()
  private klineSubscribers = new Map<string, Set<(bar: OhlcBar) => void>>()

  private activeStreams = new Set<string>()
  private subRequestId = 1

  // Book state
  private book: RawBook = { bids: new Map(), asks: new Map(), lastUpdateId: 0 }
  private bookBuffer: Array<BinanceDiffMsg> = []
  private snapshotLoaded = false
  private currentBookState: OrderBookState = {
    bids: [],
    asks: [],
    spread: null,
    spreadPct: null,
    midPrice: null,
    status: "connecting",
    isLoading: true,
  }

  // OB-049: connection health, last message, last valid revision and provider
  // timestamps, tracked separately so a quiet market is never read as a dead feed.
  private telemetry: FeedTelemetry = createTelemetry()

  // Trades state
  private currentTradesResult: UseRecentTradesResult = {
    trades: [],
    status: "connecting",
    error: null,
    isLoading: true,
  }

  // Live bar state per period
  private liveBars = new Map<string, OhlcBar | null>()

  private status: StreamStatus = "connecting"
  private usingPolling = false

  constructor(symbol: string) {
    this.symbol = symbol
    this.binanceSym = BINANCE_SYMBOL[symbol] ?? symbol.toUpperCase() + "USDT"
    this.lowerSym = this.binanceSym.toLowerCase()
    this.initTransport()
  }

  public getStatus(): StreamStatus {
    return this.status
  }

  public getBookState(): OrderBookState {
    return this.currentBookState
  }

  public getTradesResult(): UseRecentTradesResult {
    return this.currentTradesResult
  }

  public getLiveBar(period: string): OhlcBar | null {
    return this.liveBars.get(period) ?? null
  }

  /** OB-049: Transport state, derived from the stream status so there is one source of truth. */
  private feedTransport(): FeedTransport {
    switch (this.status) {
      case "connected":
      case "polling": // polling refreshes `lastMessageAt` with every successful fetch
        return "open"
      case "disconnected":
        return "closed"
      case "error":
        return "error"
      case "connecting":
        return "connecting"
    }
  }

  /** OB-049: Fresh / stale / reconnecting / unavailable for the book, with the reason. */
  public getFreshness(now: number = Date.now()): FreshnessResult {
    this.telemetry.transport = this.feedTransport()
    this.telemetry.reconnectAttempt = this.reconnectAttempt
    return deriveFreshness(this.telemetry, now, DEFAULT_FRESHNESS_POLICY)
  }

  /** OB-049: The freshness result in the shape the source health badge renders. */
  public getSourceHealth(now: number = Date.now()): { health: SourceHealth; freshness: FreshnessResult } {
    const freshness = this.getFreshness(now)
    return { health: toSourceHealth(freshness, this.telemetry, now), freshness }
  }

  /** OB-113: Exposed for testing — number of WS reconnect attempts made. */
  public getReconnectAttempt(): number {
    return this.reconnectAttempt
  }

  // ── Subscription methods (Reference-counted) ────────────────────────────────

  public subscribeBook(cb: (state: OrderBookState) => void): () => void {
    this.bookSubscribers.add(cb)
    cb(this.currentBookState)

    const streamName = `${this.lowerSym}@depth@100ms`
    this.ensureStream(streamName)

    if (!this.snapshotLoaded) {
      void this.fetchDepthSnapshot()
    }

    return () => {
      this.bookSubscribers.delete(cb)
      if (this.bookSubscribers.size === 0) {
        this.removeStream(streamName)
      }
      this.checkTeardown()
    }
  }

  public subscribeTrades(cb: (result: UseRecentTradesResult) => void): () => void {
    this.tradesSubscribers.add(cb)
    cb(this.currentTradesResult)

    const streamName = `${this.lowerSym}@trade`
    this.ensureStream(streamName)

    if (this.currentTradesResult.trades.length === 0) {
      void this.fetchTradesSnapshot()
    }

    return () => {
      this.tradesSubscribers.delete(cb)
      if (this.tradesSubscribers.size === 0) {
        this.removeStream(streamName)
      }
      this.checkTeardown()
    }
  }

  public subscribeLiveBar(period: string, cb: (bar: OhlcBar) => void): () => void {
    let periodSubs = this.klineSubscribers.get(period)
    if (!periodSubs) {
      periodSubs = new Set()
      this.klineSubscribers.set(period, periodSubs)
    }
    periodSubs.add(cb)

    const current = this.liveBars.get(period)
    if (current) cb(current)

    const binancePeriod = BINANCE_PERIOD[period]
    const streamName = binancePeriod ? `${this.lowerSym}@kline_${binancePeriod}` : null
    if (streamName) {
      this.ensureStream(streamName)
    }

    return () => {
      periodSubs.delete(cb)
      if (periodSubs.size === 0) {
        this.klineSubscribers.delete(period)
        if (streamName) {
          this.removeStream(streamName)
        }
      }
      this.checkTeardown()
    }
  }

  public totalConsumers(): number {
    let count = this.bookSubscribers.size + this.tradesSubscribers.size
    for (const subs of this.klineSubscribers.values()) {
      count += subs.size
    }
    return count
  }

  // ── Transport management ───────────────────────────────────────────────────

  /**
   * OB-113: Compute the next reconnect delay with exponential backoff + jitter.
   *
   * Backoff: BASE * 2^attempt, capped at MAX.
   * Jitter: ±JITTER_RATIO of the capped value so multiple clients do not
   * reconnect in lock-step after a server restart.
   */
  private nextReconnectDelay(): number {
    const base = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    const jitter = base * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(base + jitter))
  }

  /** OB-113: Reset the heartbeat watchdog; each WS message must call this. */
  private resetHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.isDestroyed || this.usingPolling) return
    this.heartbeatTimer = setTimeout(() => {
      // No message received within the window — treat as a missed heartbeat.
      if (!this.isDestroyed && !this.usingPolling) {
        this.scheduleWsReconnect()
      }
    }, HEARTBEAT_TIMEOUT_MS)
  }

  /** OB-113: Stop the heartbeat watchdog. */
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * OB-113: Tear down the current WebSocket and schedule a reconnect attempt
   * using the exponential backoff timer. Falls back to polling when the backoff
   * cap is reached so the UI is never left blank forever.
   */
  private scheduleWsReconnect() {
    this.stopHeartbeat()

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      try { this.ws.close() } catch {}
      this.ws = null
    }

    if (this.isDestroyed) return

    // Once we hit the ceiling, give up on WS and stay on polling.
    const delay = this.nextReconnectDelay()
    const isAtCeiling = RECONNECT_BASE_MS * 2 ** this.reconnectAttempt >= RECONNECT_MAX_MS

    this.reconnectAttempt++

    if (isAtCeiling && !this.usingPolling) {
      this.startPollingFallback()
      return
    }

    // Optimistically mark as connecting while we wait for the timer.
    this.setStatus("connecting")

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.isDestroyed && !this.usingPolling) {
        this.initTransport()
      }
    }, delay)
  }

  private initTransport() {
    this.setStatus("connecting")

    try {
      this.ws = new WebSocket(BINANCE_WS_URL)

      this.wsTimeout = setTimeout(() => {
        if (this.status === "connecting" && !this.isDestroyed) {
          this.startPollingFallback()
        }
      }, WS_CONNECT_TIMEOUT_MS)

      this.ws.onopen = () => {
        if (this.isDestroyed) return
        if (this.wsTimeout) {
          clearTimeout(this.wsTimeout)
          this.wsTimeout = null
        }
        // Successful connection — reset backoff counter.
        this.reconnectAttempt = 0
        this.setStatus("connected")
        this.stopPollingFallback()
        this.resetHeartbeat()

        // Resubscribe active streams.
        if (this.activeStreams.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const params = Array.from(this.activeStreams)
          this.ws.send(
            JSON.stringify({
              method: "SUBSCRIBE",
              params,
              id: this.subRequestId++,
            }),
          )
        }

        // OB-113: Re-fetch the depth snapshot on reconnect to recover from
        // any revision gaps that accumulated while the connection was down.
        // Mark the book as not-yet-synced so updates are buffered until the
        // snapshot's lastUpdateId is known.
        if (this.bookSubscribers.size > 0) {
          this.snapshotLoaded = false
          resetSnapshot(this.telemetry)
          this.bookBuffer = []
          void this.fetchDepthSnapshot()
        }
      }

      this.ws.onmessage = (evt: MessageEvent) => {
        if (this.isDestroyed) return
        // OB-113: Any arriving message proves the connection is alive.
        this.resetHeartbeat()
        recordMessage(this.telemetry, Date.now())
        this.handleWsMessage(evt.data)
      }

      this.ws.onerror = () => {
        if (this.isDestroyed) return
        this.stopHeartbeat()
        this.scheduleWsReconnect()
      }

      this.ws.onclose = () => {
        if (this.isDestroyed) return
        this.stopHeartbeat()
        if (!this.usingPolling) {
          this.scheduleWsReconnect()
        }
      }
    } catch {
      this.startPollingFallback()
    }
  }

  private ensureStream(streamName: string) {
    if (!this.activeStreams.has(streamName)) {
      this.activeStreams.add(streamName)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [streamName],
            id: this.subRequestId++,
          }),
        )
      }
    }
  }

  private removeStream(streamName: string) {
    if (this.activeStreams.has(streamName)) {
      this.activeStreams.delete(streamName)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            method: "UNSUBSCRIBE",
            params: [streamName],
            id: this.subRequestId++,
          }),
        )
      }
    }
  }

  private handleWsMessage(raw: unknown) {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw
      if (!data || typeof data !== "object") {
        recordMalformed(this.telemetry, Date.now())
        return
      }

      // Depth event
      if (data.e === "depthUpdate" || (data.b && data.a && data.u)) {
        if (!isValidDepthMsg(data)) {
          recordMalformed(this.telemetry, Date.now())
          return
        }
        this.handleDepthUpdate(data as BinanceDiffMsg)
      }
      // Trade event
      else if (data.e === "trade" || (data.p && data.q && data.t)) {
        this.handleTradeUpdate(data as BinanceTradeMsg)
      }
      // Kline event
      else if (data.e === "kline" && data.k) {
        this.handleKlineUpdate(data as BinanceKlineMsg)
      }
    } catch {
      // Malformed payloads never reach the book; they are counted so a feed
      // that only sends garbage is reported as degraded.
      recordMalformed(this.telemetry, Date.now())
    }
  }

  private handleDepthUpdate(msg: BinanceDiffMsg) {
    recordValidUpdate(this.telemetry, DEFAULT_FRESHNESS_POLICY, {
      receivedAt: Date.now(),
      revision: msg.u,
      providerTimestamp: typeof msg.E === "number" ? msg.E : null,
    })
    if (this.snapshotLoaded) {
      applyDelta(this.book.bids, msg.b)
      applyDelta(this.book.asks, msg.a)
      this.publishBook()
    } else {
      this.bookBuffer.push(msg)
    }
  }

  private handleTradeUpdate(msg: BinanceTradeMsg) {
    if (!msg.p || !msg.q || !msg.t) return

    const newTrade: TradeItem = {
      id: String(msg.t),
      price: parseFloat(msg.p),
      qty: parseFloat(msg.q),
      time: msg.E || Date.now(),
      side: typeof msg.m === "boolean" ? (msg.m ? "sell" : "buy") : "unknown",
      venue: "Binance Reference",
    }

    const updated = deduplicateAndSortTrades([newTrade, ...this.currentTradesResult.trades])
    this.currentTradesResult = {
      trades: updated,
      status: this.status,
      error: null,
      isLoading: false,
    }
    this.broadcastTrades()
  }

  private handleKlineUpdate(msg: BinanceKlineMsg) {
    const k = msg.k
    const bar: OhlcBar = {
      time: Math.floor(k.t / 1000),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
    }

    for (const [period, subs] of this.klineSubscribers.entries()) {
      this.liveBars.set(period, bar)
      for (const cb of subs) {
        cb(bar)
      }
    }
  }

  // ── Polling Fallback ────────────────────────────────────────────────────────

  private startPollingFallback() {
    if (this.usingPolling || this.isDestroyed) return
    this.usingPolling = true
    this.setStatus("polling")

    const poll = async () => {
      if (this.isDestroyed || !this.usingPolling) return

      try {
        const tasks: Array<Promise<unknown>> = []

        if (this.bookSubscribers.size > 0) {
          tasks.push(this.fetchDepthSnapshot())
        }
        if (this.tradesSubscribers.size > 0) {
          tasks.push(this.fetchTradesSnapshot())
        }
        for (const period of this.klineSubscribers.keys()) {
          tasks.push(
            fetchOracleCandles(this.symbol, period, 1)
              .then((res) => {
                const bars = res.candles
                if (bars.length > 0) {
                  const bar = bars[bars.length - 1]
                  this.liveBars.set(period, bar)
                  const subs = this.klineSubscribers.get(period)
                  if (subs) {
                    for (const cb of subs) cb(bar)
                  }
                }
              })
              .catch(() => {}),
          )
        }

        await Promise.allSettled(tasks)
      } finally {
        if (!this.isDestroyed && this.usingPolling) {
          this.pollTimer = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS)
        }
      }
    }

    void poll()
  }

  private stopPollingFallback() {
    this.usingPolling = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  // ── REST Snapshot Fetchers ──────────────────────────────────────────────────

  private async fetchDepthSnapshot() {
    try {
      const res = await fetch(
        `${BINANCE_REST_BASE}/api/v3/depth?symbol=${this.binanceSym}&limit=${LEVELS * 2}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as BinanceSnapshot
      if (this.isDestroyed) return

      this.book.lastUpdateId = data.lastUpdateId
      this.book.bids = new Map(data.bids)
      this.book.asks = new Map(data.asks)

      for (const msg of this.bookBuffer) {
        if (msg.u <= this.book.lastUpdateId) continue
        applyDelta(this.book.bids, msg.b)
        applyDelta(this.book.asks, msg.a)
      }
      // The book is at the newest revision seen, including buffered updates.
      const newestRevision = this.bookBuffer.reduce(
        (max, msg) => Math.max(max, msg.u),
        this.book.lastUpdateId,
      )
      this.bookBuffer = []
      this.snapshotLoaded = true
      recordSnapshot(this.telemetry, Date.now(), newestRevision)
      this.publishBook()
    } catch {
      if (this.isDestroyed) return
      this.currentBookState = {
        ...this.currentBookState,
        status: this.usingPolling ? "polling" : "error",
        isLoading: false,
      }
      this.broadcastBook()
    }
  }

  private async fetchTradesSnapshot() {
    try {
      const res = await fetch(
        `${BINANCE_REST_BASE}/api/v3/trades?symbol=${this.binanceSym}&limit=${MAX_TRADES}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as Array<BinanceRestTrade>
      if (this.isDestroyed) return

      const parsed: Array<TradeItem> = raw.map((item) => ({
        id: String(item.id),
        price: parseFloat(item.price),
        qty: parseFloat(item.qty),
        time: item.time,
        side:
          typeof item.isBuyerMaker === "boolean"
            ? item.isBuyerMaker
              ? "sell"
              : "buy"
            : "unknown",
        venue: "Binance Reference",
      }))

      const merged = deduplicateAndSortTrades([...parsed, ...this.currentTradesResult.trades])
      this.currentTradesResult = {
        trades: merged,
        status: this.status,
        error: null,
        isLoading: false,
      }
      this.broadcastTrades()
    } catch {
      if (this.isDestroyed) return
      this.currentTradesResult = {
        ...this.currentTradesResult,
        status: this.usingPolling ? "polling" : "error",
        isLoading: false,
      }
      this.broadcastTrades()
    }
  }

  // ── State Publishing ────────────────────────────────────────────────────────

  private publishBook() {
    const bids = buildLevels(this.book.bids, false)
    const asks = buildLevels(this.book.asks, true)
    const bestBid = bids[0]?.price ?? null
    const bestAsk = asks[0]?.price ?? null
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null
    const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null
    const pct = spread !== null && mid !== null && mid > 0 ? (spread / mid) * 100 : null

    this.currentBookState = {
      bids,
      asks,
      spread,
      spreadPct: pct,
      midPrice: mid,
      status: this.status === "polling" ? "polling" : "connected",
      isLoading: false,
    }
    this.broadcastBook()
  }

  private setStatus(status: StreamStatus) {
    this.status = status
    this.currentBookState.status = status === "polling" ? "polling" : status
    this.currentTradesResult.status = status
    this.broadcastBook()
    this.broadcastTrades()
  }

  private broadcastBook() {
    for (const cb of this.bookSubscribers) {
      cb(this.currentBookState)
    }
  }

  private broadcastTrades() {
    for (const cb of this.tradesSubscribers) {
      cb(this.currentTradesResult)
    }
  }

  private checkTeardown() {
    if (this.totalConsumers() === 0) {
      this.destroy()
    }
  }

  public destroy() {
    if (this.isDestroyed) return
    this.isDestroyed = true

    if (this.wsTimeout) {
      clearTimeout(this.wsTimeout)
      this.wsTimeout = null
    }
    // OB-113: cancel pending reconnect and heartbeat timers.
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPollingFallback()

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }

    this.bookSubscribers.clear()
    this.tradesSubscribers.clear()
    this.klineSubscribers.clear()
    this.activeStreams.clear()
    marketSubscriptionManager.removeInstance(this.symbol)
  }
}

class MarketDataStreamManager {
  private instances = new Map<string, SharedMarketSubscription>()

  public getOrCreate(symbol: string): SharedMarketSubscription {
    const key = symbol.toUpperCase()
    let instance = this.instances.get(key)
    if (!instance) {
      instance = new SharedMarketSubscription(key)
      this.instances.set(key, instance)
    }
    return instance
  }

  public removeInstance(symbol: string) {
    this.instances.delete(symbol.toUpperCase())
  }

  public getActiveSourceCount(): number {
    return this.instances.size
  }
}

export const marketSubscriptionManager = new MarketDataStreamManager()
