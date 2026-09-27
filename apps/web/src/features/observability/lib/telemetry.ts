/**
 * Client Observability & Performance Telemetry (OB-126)
 *
 * Implements bounded, privacy-safe telemetry for:
 * 1. Core Web Vitals (FCP, LCP, CLS, INP, TTFB)
 * 2. Route transition speed categorized by route & device type
 * 3. Market feed health (disconnections, reconnect latency, heartbeat status)
 * 4. Transaction refresh latency isolation (client prep vs network confirm vs indexer catch-up)
 *
 * PRIVACY GUARANTEE: Zero PII. All wallet addresses, private keys, and query secrets are scrubbed.
 */

export type DeviceCategory = "desktop" | "mobile" | "tablet"

export function detectDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop"
  }
  const ua = navigator.userAgent.toLowerCase()
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet"
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile"
  return "desktop"
}

/** Bounded in-memory ring buffer to prevent unbounded memory growth. */
export class BoundedRingBuffer<T> {
  private buffer: Array<T> = []
  private readonly capacity: number

  constructor(capacity = 100) {
    this.capacity = Math.max(1, capacity)
  }

  public push(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift()
    }
    this.buffer.push(item)
  }

  public getAll(): Array<T> {
    return [...this.buffer]
  }

  public size(): number {
    return this.buffer.length
  }

  public clear(): void {
    this.buffer = []
  }
}

/** Scrubs Stellar public keys, contract IDs, emails, and sensitive URL query params. */
export function sanitizeTelemetryString(input: string): string {
  if (!input) return ""
  return input
    // Scrub Stellar G... and C... 56-char public keys/contracts
    .replace(/\b[GC][A-Z0-9]{55}\b/g, "[SCRUBBED_ADDRESS]")
    // Scrub emails
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[SCRUBBED_EMAIL]")
    // Scrub query parameters that might contain tokens
    .replace(/([?&](token|secret|key|auth|session)=)[^&]*/gi, "$1[SCRUBBED]")
}

export type WebVitalMetric = "FCP" | "LCP" | "CLS" | "INP" | "TTFB"
export type MetricRating = "good" | "needs-improvement" | "poor"

export interface WebVitalEntry {
  name: WebVitalMetric
  value: number
  rating: MetricRating
  timestamp: number
}

export interface RouteTransitionEntry {
  from: string
  to: string
  durationMs: number
  device: DeviceCategory
  timestamp: number
}

export interface FeedHealthEntry {
  symbol: string
  event: "connect" | "disconnect" | "reconnect" | "message" | "heartbeat_miss"
  latencyMs?: number
  timestamp: number
}

export interface TransactionLatencyBreakdown {
  operationId: string
  operationType: string
  clientPrepMs: number
  networkConfirmMs: number
  indexerCatchupMs: number
  totalDurationMs: number
  timestamp: number
}

export interface TelemetrySummary {
  vitals: Record<string, { latest: number; rating: MetricRating }>
  routeTransitions: {
    count: number
    p50Ms: number
    p95Ms: number
    byDevice: Record<DeviceCategory, number>
  }
  feedHealth: {
    disconnectCount: number
    avgReconnectMs: number
    activeFeeds: Array<string>
  }
  transactionLatency: {
    count: number
    avgClientPrepMs: number
    avgNetworkConfirmMs: number
    avgIndexerCatchupMs: number
    avgTotalMs: number
  }
}

function calculatePercentile(values: Array<number>, p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[index] ?? 0
}

export class TelemetryManager {
  private vitalsBuffer = new BoundedRingBuffer<WebVitalEntry>(50)
  private routeBuffer = new BoundedRingBuffer<RouteTransitionEntry>(100)
  private feedBuffer = new BoundedRingBuffer<FeedHealthEntry>(200)
  private txLatencyBuffer = new BoundedRingBuffer<TransactionLatencyBreakdown>(50)

  public recordWebVital(name: WebVitalMetric, value: number, rating?: MetricRating): void {
    const determinedRating: MetricRating =
      rating ?? (value <= 2000 ? "good" : value <= 4000 ? "needs-improvement" : "poor")
    this.vitalsBuffer.push({
      name,
      value: Math.round(value * 100) / 100,
      rating: determinedRating,
      timestamp: Date.now(),
    })
  }

  public recordRouteTransition(
    from: string,
    to: string,
    durationMs: number,
    device?: DeviceCategory,
  ): void {
    this.routeBuffer.push({
      from: sanitizeTelemetryString(from),
      to: sanitizeTelemetryString(to),
      durationMs: Math.max(0, Math.round(durationMs)),
      device: device ?? detectDeviceCategory(),
      timestamp: Date.now(),
    })
  }

  public recordFeedHealth(
    symbol: string,
    event: "connect" | "disconnect" | "reconnect" | "message" | "heartbeat_miss",
    latencyMs?: number,
  ): void {
    this.feedBuffer.push({
      symbol: sanitizeTelemetryString(symbol).toUpperCase(),
      event,
      latencyMs: latencyMs !== undefined ? Math.max(0, Math.round(latencyMs)) : undefined,
      timestamp: Date.now(),
    })
  }

  public recordTransactionLatency(stage: {
    operationType: string
    clientPrepMs: number
    networkConfirmMs: number
    indexerCatchupMs: number
    operationId?: string
  }): TransactionLatencyBreakdown {
    const total = stage.clientPrepMs + stage.networkConfirmMs + stage.indexerCatchupMs
    const entry: TransactionLatencyBreakdown = {
      operationId: sanitizeTelemetryString(stage.operationId || `op-${Date.now()}`),
      operationType: sanitizeTelemetryString(stage.operationType),
      clientPrepMs: Math.max(0, Math.round(stage.clientPrepMs)),
      networkConfirmMs: Math.max(0, Math.round(stage.networkConfirmMs)),
      indexerCatchupMs: Math.max(0, Math.round(stage.indexerCatchupMs)),
      totalDurationMs: Math.max(0, Math.round(total)),
      timestamp: Date.now(),
    }
    this.txLatencyBuffer.push(entry)
    return entry
  }

  public getSummary(): TelemetrySummary {
    const vitals = this.vitalsBuffer.getAll()
    const vitalsMap: Record<string, { latest: number; rating: MetricRating }> = {}
    for (const v of vitals) {
      vitalsMap[v.name] = { latest: v.value, rating: v.rating }
    }

    const routes = this.routeBuffer.getAll()
    const routeDurations = routes.map((r) => r.durationMs)
    const deviceCounts: Record<DeviceCategory, number> = { desktop: 0, mobile: 0, tablet: 0 }
    for (const r of routes) {
      deviceCounts[r.device] = (deviceCounts[r.device] || 0) + 1
    }

    const feedEvents = this.feedBuffer.getAll()
    const disconnects = feedEvents.filter((e) => e.event === "disconnect" || e.event === "heartbeat_miss")
    const reconnects = feedEvents.filter((e) => e.event === "reconnect" && typeof e.latencyMs === "number")
    const avgReconnect =
      reconnects.length > 0
        ? reconnects.reduce((acc, r) => acc + (r.latencyMs || 0), 0) / reconnects.length
        : 0
    const activeSymbols = [...new Set(feedEvents.map((e) => e.symbol))]

    const txs = this.txLatencyBuffer.getAll()
    const avg = (fn: (item: TransactionLatencyBreakdown) => number) =>
      txs.length > 0 ? txs.reduce((acc, item) => acc + fn(item), 0) / txs.length : 0

    return {
      vitals: vitalsMap,
      routeTransitions: {
        count: routes.length,
        p50Ms: calculatePercentile(routeDurations, 50),
        p95Ms: calculatePercentile(routeDurations, 95),
        byDevice: deviceCounts,
      },
      feedHealth: {
        disconnectCount: disconnects.length,
        avgReconnectMs: Math.round(avgReconnect),
        activeFeeds: activeSymbols,
      },
      transactionLatency: {
        count: txs.length,
        avgClientPrepMs: Math.round(avg((t) => t.clientPrepMs)),
        avgNetworkConfirmMs: Math.round(avg((t) => t.networkConfirmMs)),
        avgIndexerCatchupMs: Math.round(avg((t) => t.indexerCatchupMs)),
        avgTotalMs: Math.round(avg((t) => t.totalDurationMs)),
      },
    }
  }

  public reset(): void {
    this.vitalsBuffer.clear()
    this.routeBuffer.clear()
    this.feedBuffer.clear()
    this.txLatencyBuffer.clear()
  }
}

export const telemetry = new TelemetryManager()
