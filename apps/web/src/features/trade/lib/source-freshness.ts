/**
 * OB-049: Market-data source health and freshness.
 *
 * A market feed has several independent clocks, and mixing them up is how a
 * quiet market gets reported as a dead connection (or a dead connection as a
 * quiet market). They are tracked separately here:
 *
 *  - connection health: the transport state, and `lastMessageAt`, the local
 *    time ANY frame arrived (data, heartbeat or ack). Silence on the transport
 *    is what proves it dead.
 *  - last valid update: the local time and revision of the last book update
 *    that parsed and advanced the revision. A market with no trades still
 *    has a healthy transport, so this alone never marks a feed stale.
 *  - provider timestamps: the provider's own event time on those updates.
 *    Comparing them with local receipt time measures how far the provider
 *    is lagging, after removing the constant offset between the two clocks.
 *
 * This module is pure: every function takes `now` explicitly and mutates
 * nothing but the telemetry it is given, so behaviour is fully deterministic
 * under test.
 */

import type { SourceHealth } from "../hooks/useSourceHealth"

export type FeedTransport = "connecting" | "open" | "closed" | "error"

export type FreshnessState = "fresh" | "stale" | "reconnecting" | "unavailable"

/** Why the feed is in its current state. Distinct so the UI and tests can tell them apart. */
export type FreshnessReason =
  | "live" // updates are arriving
  | "quiet-market" // transport healthy and heartbeating, but no book change lately
  | "connecting" // first connection attempt, nothing to show yet
  | "awaiting-snapshot" // transport open but no valid book yet
  | "transport-silent" // transport claims to be open but nothing has arrived for too long
  | "transport-closed" // transport dropped; a retry is under way
  | "transport-error" // transport failed
  | "malformed-updates" // frames arrive but keep failing validation
  | "provider-lagging" // provider delivers updates far later than its own timestamps
  | "data-expired" // last valid book is too old to show at all

export type FreshnessPolicy = {
  /** Longest silence (no frame of any kind) tolerated on an open transport. */
  heartbeatTimeoutMs: number
  /** Extra delivery delay, beyond the fastest recently seen, that marks the provider as lagging. */
  maxProviderLagMs: number
  /** Consecutive malformed frames, with no valid update since, that mark the feed degraded. */
  malformedThreshold: number
  /** After this long without a valid update the last book is discarded as unusable. */
  expireAfterMs: number
  /** Delivery-delay samples kept for the baseline (clock offset) estimate. */
  skewWindow: number
}

export const DEFAULT_FRESHNESS_POLICY: FreshnessPolicy = {
  heartbeatTimeoutMs: 20_000, // matches the stream's heartbeat watchdog
  maxProviderLagMs: 5_000,
  malformedThreshold: 3,
  expireAfterMs: 5 * 60_000,
  skewWindow: 32,
}

export type FeedTelemetry = {
  transport: FeedTransport
  reconnectAttempt: number
  /** A book snapshot has been applied, so depth exists to show. */
  hasSnapshot: boolean
  /** Local time the last frame of ANY kind arrived. */
  lastMessageAt: number | null
  /** Local time the last valid book update (or snapshot) was applied. */
  lastValidUpdateAt: number | null
  /** Revision of the last valid update; only ever increases. */
  lastValidRevision: number | null
  /** Provider event time of the last valid update. */
  lastProviderTimestamp: number | null
  /** Recent `receivedAt - providerTimestamp` samples, used to remove the clock offset. */
  deliveryDelays: Array<number>
  /** Delivery delay of the most recent valid update. */
  lastDeliveryDelay: number | null
  consecutiveMalformed: number
  malformedTotal: number
}

export function createTelemetry(): FeedTelemetry {
  return {
    transport: "connecting",
    reconnectAttempt: 0,
    hasSnapshot: false,
    lastMessageAt: null,
    lastValidUpdateAt: null,
    lastValidRevision: null,
    lastProviderTimestamp: null,
    deliveryDelays: [],
    lastDeliveryDelay: null,
    consecutiveMalformed: 0,
    malformedTotal: 0,
  }
}

export function recordTransport(
  t: FeedTelemetry,
  transport: FeedTransport,
  reconnectAttempt = t.reconnectAttempt
): void {
  t.transport = transport
  t.reconnectAttempt = reconnectAttempt
}

/** Any frame arrived: data, heartbeat, subscription ack. Proves the transport is alive. */
export function recordMessage(t: FeedTelemetry, receivedAt: number): void {
  t.lastMessageAt = receivedAt
}

/** A frame arrived but could not be used. Also counts as proof of a live transport. */
export function recordMalformed(t: FeedTelemetry, receivedAt: number): void {
  t.lastMessageAt = receivedAt
  t.consecutiveMalformed += 1
  t.malformedTotal += 1
}

type ValidUpdate = {
  receivedAt: number
  revision: number
  /** Provider event time in ms. Omit when the update carries none. */
  providerTimestamp?: number | null
}

/**
 * A book update that parsed. Returns false, and leaves the book bookkeeping
 * untouched, for a duplicate or out-of-order revision: replaying an old
 * revision must not make a feed look fresher than it is.
 */
export function recordValidUpdate(
  t: FeedTelemetry,
  policy: FreshnessPolicy,
  update: ValidUpdate
): boolean {
  t.lastMessageAt = update.receivedAt
  if (t.lastValidRevision !== null && update.revision <= t.lastValidRevision) {
    return false
  }
  t.lastValidRevision = update.revision
  t.lastValidUpdateAt = update.receivedAt
  t.consecutiveMalformed = 0

  const ts = update.providerTimestamp
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const delay = update.receivedAt - ts
    t.lastProviderTimestamp = ts
    t.lastDeliveryDelay = delay
    t.deliveryDelays.push(delay)
    if (t.deliveryDelays.length > policy.skewWindow) t.deliveryDelays.shift()
  }
  return true
}

/** A full snapshot was applied. It establishes the book and its revision. */
export function recordSnapshot(
  t: FeedTelemetry,
  receivedAt: number,
  revision: number
): void {
  t.lastMessageAt = receivedAt
  t.hasSnapshot = true
  t.lastValidUpdateAt = receivedAt
  t.lastValidRevision = revision
  t.consecutiveMalformed = 0
}

/** The book was discarded (e.g. resync after reconnect); depth must be rebuilt before use. */
export function resetSnapshot(t: FeedTelemetry): void {
  t.hasSnapshot = false
  t.lastValidRevision = null
  t.lastValidUpdateAt = null
}

export type FreshnessResult = {
  state: FreshnessState
  reason: FreshnessReason
  /**
   * Whether depth from this feed may seed an actionable quote (a price
   * suggested into an order ticket). Only a fresh feed with an applied
   * snapshot may; stale depth must never.
   */
  canSeedQuote: boolean
  /** ms since any frame arrived, or null if none has. */
  lastMessageAgeMs: number | null
  /** ms since the last valid book update, or null if none has been applied. */
  lastValidUpdateAgeMs: number | null
  /**
   * How much later than usual the latest update reached us, in ms, with the
   * fixed offset between our clock and the provider's removed. Null without
   * provider timestamps.
   */
  providerLagMs: number | null
  /** Estimated `local clock - provider clock` in ms (includes minimum network latency), or null. */
  clockOffsetMs: number | null
}

function result(
  t: FeedTelemetry,
  now: number,
  state: FreshnessState,
  reason: FreshnessReason,
  extra: { providerLagMs: number | null; clockOffsetMs: number | null }
): FreshnessResult {
  return {
    state,
    reason,
    canSeedQuote: state === "fresh" && t.hasSnapshot && t.lastValidRevision !== null,
    lastMessageAgeMs: t.lastMessageAt === null ? null : Math.max(0, now - t.lastMessageAt),
    lastValidUpdateAgeMs:
      t.lastValidUpdateAt === null ? null : Math.max(0, now - t.lastValidUpdateAt),
    ...extra,
  }
}

/**
 * Fresh / stale / reconnecting / unavailable, with the reason.
 *
 * Order matters and encodes the policy:
 *  1. No usable book at all -> unavailable (or reconnecting if a retry is under way).
 *  2. Transport down -> reconnecting, and after `expireAfterMs` unavailable.
 *  3. Open transport, checked from most to least severe: silence beyond the
 *     heartbeat timeout, then a stream of malformed frames, then a lagging
 *     provider. Any of them is stale.
 *  4. Otherwise fresh. A long gap since the last book change is NOT a reason
 *     to distrust the feed: `quiet-market` is reported so it is visible, but
 *     stays fresh.
 */
export function deriveFreshness(
  t: FeedTelemetry,
  now: number,
  policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICY
): FreshnessResult {
  const clockOffsetMs = t.deliveryDelays.length > 0 ? Math.min(...t.deliveryDelays) : null
  const providerLagMs =
    t.lastDeliveryDelay !== null && clockOffsetMs !== null
      ? Math.max(0, t.lastDeliveryDelay - clockOffsetMs)
      : null
  const extra = { providerLagMs, clockOffsetMs }

  const validAge = t.lastValidUpdateAt === null ? null : Math.max(0, now - t.lastValidUpdateAt)
  const hasBook = t.hasSnapshot && t.lastValidRevision !== null

  if (t.transport === "error" || t.transport === "closed") {
    if (!hasBook) return result(t, now, "unavailable", t.transport === "error" ? "transport-error" : "transport-closed", extra)
    if (validAge !== null && validAge > policy.expireAfterMs) {
      return result(t, now, "unavailable", "data-expired", extra)
    }
    return result(
      t,
      now,
      "reconnecting",
      t.transport === "error" ? "transport-error" : "transport-closed",
      extra
    )
  }

  if (t.transport === "connecting") {
    if (!hasBook) {
      return result(
        t,
        now,
        t.reconnectAttempt > 0 ? "reconnecting" : "unavailable",
        "connecting",
        extra
      )
    }
    if (validAge !== null && validAge > policy.expireAfterMs) {
      return result(t, now, "unavailable", "data-expired", extra)
    }
    return result(t, now, "reconnecting", "transport-closed", extra)
  }

  // transport === "open"
  if (!hasBook) return result(t, now, "unavailable", "awaiting-snapshot", extra)

  if (validAge !== null && validAge > policy.expireAfterMs) {
    return result(t, now, "unavailable", "data-expired", extra)
  }

  const silence = t.lastMessageAt === null ? Infinity : now - t.lastMessageAt
  if (silence > policy.heartbeatTimeoutMs) {
    return result(t, now, "stale", "transport-silent", extra)
  }

  if (t.consecutiveMalformed >= policy.malformedThreshold) {
    return result(t, now, "stale", "malformed-updates", extra)
  }

  if (providerLagMs !== null && providerLagMs > policy.maxProviderLagMs) {
    return result(t, now, "stale", "provider-lagging", extra)
  }

  // Healthy transport. Distinguish a quiet market from a busy one for display only.
  const quiet = validAge !== null && validAge > policy.heartbeatTimeoutMs
  return result(t, now, "fresh", quiet ? "quiet-market" : "live", extra)
}

/** Maps a freshness result onto the health model the existing badge renders. */
export function toSourceHealth(
  freshness: FreshnessResult,
  t: FeedTelemetry,
  now: number
): SourceHealth {
  const lastUpdateTime = t.lastValidUpdateAt
  const staleDuration = freshness.lastValidUpdateAgeMs
  const base = { lastUpdateTime, reconnectAttempt: t.reconnectAttempt }

  switch (freshness.state) {
    case "fresh":
      return {
        ...base,
        status: "connected",
        staleDuration: null,
        isExecutable: freshness.canSeedQuote,
        message: freshness.reason === "quiet-market" ? "Live — no recent book changes" : "Live market data",
      }
    case "stale":
      return {
        ...base,
        status: "stale",
        staleDuration,
        isExecutable: false,
        message: STALE_MESSAGES[freshness.reason] ?? "Market data is stale",
      }
    case "reconnecting":
      return {
        ...base,
        status: "reconnecting",
        staleDuration,
        isExecutable: false,
        message:
          t.reconnectAttempt > 0
            ? `Reconnecting (attempt ${t.reconnectAttempt})…`
            : "Reconnecting to market data…",
      }
    case "unavailable":
      return {
        ...base,
        status: freshness.reason === "connecting" || freshness.reason === "awaiting-snapshot" ? "initial-load" : "error",
        staleDuration: now === 0 ? null : staleDuration,
        isExecutable: false,
        message:
          freshness.reason === "data-expired"
            ? "Market data expired — waiting for a fresh book"
            : freshness.reason === "connecting" || freshness.reason === "awaiting-snapshot"
              ? "Connecting to market data feed…"
              : "Market data unavailable",
      }
  }
}

const STALE_MESSAGES: Partial<Record<FreshnessReason, string>> = {
  "transport-silent": "No data received — connection may be dead",
  "malformed-updates": "Receiving invalid updates — showing last valid book",
  "provider-lagging": "Provider is delivering updates late",
}

type Level = { price: number; size: number }
type Book = { bids: ReadonlyArray<Level>; asks: ReadonlyArray<Level> }

/**
 * The only sanctioned way to turn feed depth into a suggested price for an
 * order ticket. Returns null unless the feed is fresh with an applied
 * snapshot, and unless the book is uncrossed, so stale, unsynced or broken
 * depth can never seed an actionable quote.
 */
export function quoteFromDepth(
  book: Book,
  freshness: FreshnessResult
): { bid: number; ask: number; mid: number } | null {
  if (!freshness.canSeedQuote) return null
  const bid = book.bids.at(0)?.price
  const ask = book.asks.at(0)?.price
  if (bid === undefined || ask === undefined) return null
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return null
  if (bid >= ask) return null
  return { bid, ask, mid: (bid + ask) / 2 }
}
