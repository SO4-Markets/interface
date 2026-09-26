import { describe, expect, it } from "vitest"
import {
  
  DEFAULT_FRESHNESS_POLICY as POLICY,
  createTelemetry,
  deriveFreshness,
  quoteFromDepth,
  recordMalformed,
  recordMessage,
  recordSnapshot,
  recordTransport,
  recordValidUpdate,
  resetSnapshot,
  toSourceHealth
} from "./source-freshness"
import type {FeedTelemetry} from "./source-freshness";

const T0 = 1_000_000

/** A healthy open feed: snapshot applied at T0, then live updates. */
function liveFeed(opts: { providerOffset?: number } = {}): FeedTelemetry {
  const t = createTelemetry()
  recordTransport(t, "open")
  recordSnapshot(t, T0, 100)
  recordValidUpdate(t, POLICY, {
    receivedAt: T0 + 100,
    revision: 101,
    providerTimestamp: T0 + 100 - 40 - (opts.providerOffset ?? 0),
  })
  return t
}

const book = {
  bids: [{ price: 99, size: 1 }],
  asks: [{ price: 101, size: 1 }],
}

describe("initial and unavailable states", () => {
  it("is unavailable, not stale, before the first connection completes", () => {
    const t = createTelemetry()
    const f = deriveFreshness(t, T0)
    expect(f).toMatchObject({ state: "unavailable", reason: "connecting", canSeedQuote: false })
    expect(f.lastMessageAgeMs).toBeNull()
    expect(f.lastValidUpdateAgeMs).toBeNull()
  })

  it("is reconnecting when a first-ever connection is being retried", () => {
    const t = createTelemetry()
    recordTransport(t, "connecting", 2)
    expect(deriveFreshness(t, T0)).toMatchObject({ state: "reconnecting", reason: "connecting" })
  })

  it("is unavailable while an open transport has not delivered a snapshot", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordMessage(t, T0)
    expect(deriveFreshness(t, T0 + 1)).toMatchObject({
      state: "unavailable",
      reason: "awaiting-snapshot",
      canSeedQuote: false,
    })
  })

  it("delta updates before any snapshot do not create a usable book", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordValidUpdate(t, POLICY, { receivedAt: T0, revision: 5, providerTimestamp: T0 - 10 })
    expect(deriveFreshness(t, T0 + 1).canSeedQuote).toBe(false)
  })
})

describe("a healthy feed", () => {
  it("is fresh and may seed a quote", () => {
    const f = deriveFreshness(liveFeed(), T0 + 500)
    expect(f).toMatchObject({ state: "fresh", reason: "live", canSeedQuote: true })
  })

  it("reports ages from local receipt times", () => {
    const f = deriveFreshness(liveFeed(), T0 + 1_100)
    expect(f.lastMessageAgeMs).toBe(1_000)
    expect(f.lastValidUpdateAgeMs).toBe(1_000)
  })
})

describe("a market with no trades is not a dead connection", () => {
  it("stays fresh when the book is unchanged for minutes but heartbeats keep arriving", () => {
    const t = liveFeed()
    const start = T0 + 100
    // Heartbeat/ack frames every 10s for 4 minutes, and not one book change.
    for (let s = 10_000; s <= 240_000; s += 10_000) recordMessage(t, start + s)

    const f = deriveFreshness(t, start + 240_000)
    expect(f).toMatchObject({ state: "fresh", reason: "quiet-market", canSeedQuote: true })
    expect(f.lastValidUpdateAgeMs).toBe(240_000)
  })

  it("still reports quiet-market without heartbeat frames as long as some frame is recent", () => {
    const t = liveFeed()
    recordMessage(t, T0 + 60_000)
    expect(deriveFreshness(t, T0 + 65_000)).toMatchObject({
      state: "fresh",
      reason: "quiet-market",
    })
  })
})

describe("dead transport", () => {
  it("goes stale when an open transport goes silent past the heartbeat timeout", () => {
    const t = liveFeed()
    const f = deriveFreshness(t, T0 + 100 + POLICY.heartbeatTimeoutMs + 1)
    expect(f).toMatchObject({ state: "stale", reason: "transport-silent", canSeedQuote: false })
  })

  it("is not stale exactly at the timeout boundary", () => {
    const t = liveFeed()
    expect(deriveFreshness(t, T0 + 100 + POLICY.heartbeatTimeoutMs).state).toBe("fresh")
  })

  it("is reconnecting once the transport reports closed, keeping the last book visible", () => {
    const t = liveFeed()
    recordTransport(t, "closed", 1)
    expect(deriveFreshness(t, T0 + 2_000)).toMatchObject({
      state: "reconnecting",
      reason: "transport-closed",
      canSeedQuote: false,
    })
  })

  it("is reconnecting after a transport error when a book exists, unavailable when none does", () => {
    const withBook = liveFeed()
    recordTransport(withBook, "error", 1)
    expect(deriveFreshness(withBook, T0 + 1_000)).toMatchObject({
      state: "reconnecting",
      reason: "transport-error",
    })

    const noBook = createTelemetry()
    recordTransport(noBook, "error", 1)
    expect(deriveFreshness(noBook, T0)).toMatchObject({
      state: "unavailable",
      reason: "transport-error",
    })
  })

  it("expires the last book after a long outage", () => {
    const t = liveFeed()
    recordTransport(t, "closed", 6)
    const f = deriveFreshness(t, T0 + 100 + POLICY.expireAfterMs + 1)
    expect(f).toMatchObject({ state: "unavailable", reason: "data-expired", canSeedQuote: false })
  })

  it("expires an open but silent-for-ever feed too", () => {
    const t = liveFeed()
    expect(deriveFreshness(t, T0 + 100 + POLICY.expireAfterMs + 1)).toMatchObject({
      state: "unavailable",
      reason: "data-expired",
    })
  })

  it("recovers to fresh once a reconnect delivers a new snapshot", () => {
    const t = liveFeed()
    recordTransport(t, "closed", 1)
    resetSnapshot(t)
    recordTransport(t, "open", 0)
    recordMessage(t, T0 + 5_000)
    expect(deriveFreshness(t, T0 + 5_001).reason).toBe("awaiting-snapshot")

    recordSnapshot(t, T0 + 5_200, 500)
    expect(deriveFreshness(t, T0 + 5_300)).toMatchObject({ state: "fresh", canSeedQuote: true })
  })
})

describe("malformed updates", () => {
  it("counts as stale after the threshold of consecutive bad frames", () => {
    const t = liveFeed()
    for (let i = 1; i < POLICY.malformedThreshold; i++) recordMalformed(t, T0 + 200 + i)
    expect(deriveFreshness(t, T0 + 300).state).toBe("fresh")

    recordMalformed(t, T0 + 400)
    expect(deriveFreshness(t, T0 + 500)).toMatchObject({
      state: "stale",
      reason: "malformed-updates",
      canSeedQuote: false,
    })
  })

  it("is not mistaken for a dead transport: frames are arriving", () => {
    const t = liveFeed()
    for (let i = 0; i < 5; i++) recordMalformed(t, T0 + 1_000 * (i + 1))
    const f = deriveFreshness(t, T0 + 5_500)
    expect(f.reason).toBe("malformed-updates")
    expect(f.lastMessageAgeMs).toBe(500)
  })

  it("clears as soon as a valid update arrives", () => {
    const t = liveFeed()
    for (let i = 0; i < 5; i++) recordMalformed(t, T0 + 200 + i)
    recordValidUpdate(t, POLICY, { receivedAt: T0 + 300, revision: 102, providerTimestamp: T0 + 260 })
    expect(deriveFreshness(t, T0 + 301)).toMatchObject({ state: "fresh", canSeedQuote: true })
  })

  it("keeps a running total for diagnostics", () => {
    const t = liveFeed()
    recordMalformed(t, T0 + 200)
    recordValidUpdate(t, POLICY, { receivedAt: T0 + 300, revision: 102 })
    recordMalformed(t, T0 + 400)
    expect(t.malformedTotal).toBe(2)
    expect(t.consecutiveMalformed).toBe(1)
  })
})

describe("lagging provider", () => {
  /** Establish a normal ~40ms delivery baseline, then deliver one update very late. */
  function feedThenLate(extraDelay: number): FeedTelemetry {
    const t = liveFeed()
    for (let i = 0; i < 5; i++) {
      const received = T0 + 200 + i * 100
      recordValidUpdate(t, POLICY, { receivedAt: received, revision: 102 + i, providerTimestamp: received - 40 })
    }
    const received = T0 + 1_000
    recordValidUpdate(t, POLICY, {
      receivedAt: received,
      revision: 200,
      providerTimestamp: received - 40 - extraDelay,
    })
    return t
  }

  it("goes stale when the provider delivers updates far later than its own timestamps", () => {
    const f = deriveFreshness(feedThenLate(POLICY.maxProviderLagMs + 1_000), T0 + 1_001)
    expect(f).toMatchObject({ state: "stale", reason: "provider-lagging", canSeedQuote: false })
    expect(f.providerLagMs).toBe(POLICY.maxProviderLagMs + 1_000)
  })

  it("tolerates lag within the policy", () => {
    const f = deriveFreshness(feedThenLate(1_000), T0 + 1_001)
    expect(f.state).toBe("fresh")
    expect(f.providerLagMs).toBe(1_000)
  })

  it("is not the same as a quiet market: lag needs delivered-late updates, not a long gap", () => {
    const t = liveFeed()
    recordMessage(t, T0 + 30_000)
    const f = deriveFreshness(t, T0 + 31_000)
    expect(f.reason).toBe("quiet-market")
    expect(f.providerLagMs).toBe(0)
  })

  it("recovers when the provider catches up", () => {
    const t = feedThenLate(POLICY.maxProviderLagMs + 1_000)
    const received = T0 + 2_000
    recordValidUpdate(t, POLICY, { receivedAt: received, revision: 201, providerTimestamp: received - 40 })
    expect(deriveFreshness(t, received + 1).state).toBe("fresh")
  })

  it("has no lag figure when the provider sends no timestamps", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordSnapshot(t, T0, 1)
    recordValidUpdate(t, POLICY, { receivedAt: T0 + 100, revision: 2 })
    const f = deriveFreshness(t, T0 + 200)
    expect(f).toMatchObject({ state: "fresh", providerLagMs: null, clockOffsetMs: null })
  })
})

describe("clock skew between us and the provider", () => {
  it.each([
    ["our clock 10 minutes ahead", 600_000],
    ["our clock 10 minutes behind", -600_000],
    ["in step", 0],
  ])("a constant offset is not lag (%s)", (_label, skew) => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordSnapshot(t, T0, 1)
    for (let i = 0; i < 10; i++) {
      const received = T0 + 100 + i * 100
      // Provider timestamps are `skew` ms away from our clock, plus ~40ms transit.
      recordValidUpdate(t, POLICY, { receivedAt: received, revision: 2 + i, providerTimestamp: received - skew - 40 })
    }
    const f = deriveFreshness(t, T0 + 1_200)
    expect(f).toMatchObject({ state: "fresh", providerLagMs: 0, canSeedQuote: true })
    expect(f.clockOffsetMs).toBe(skew + 40)
  })

  it("still detects real lag under a large skew", () => {
    const skew = 600_000
    const t = createTelemetry()
    recordTransport(t, "open")
    recordSnapshot(t, T0, 1)
    for (let i = 0; i < 5; i++) {
      const received = T0 + 100 + i * 100
      recordValidUpdate(t, POLICY, { receivedAt: received, revision: 2 + i, providerTimestamp: received - skew - 40 })
    }
    const received = T0 + 1_000
    recordValidUpdate(t, POLICY, {
      receivedAt: received,
      revision: 50,
      providerTimestamp: received - skew - 40 - 8_000,
    })
    expect(deriveFreshness(t, received + 1)).toMatchObject({ state: "stale", reason: "provider-lagging" })
  })

  it("re-baselines when the offset drifts, because only a bounded window is kept", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordSnapshot(t, T0, 1)
    for (let i = 0; i < POLICY.skewWindow; i++) {
      recordValidUpdate(t, POLICY, { receivedAt: T0 + i, revision: 2 + i, providerTimestamp: T0 + i - 40 })
    }
    // The provider clock steps 5 minutes: all later samples share the new offset.
    const shift = 300_000
    for (let i = 0; i < POLICY.skewWindow; i++) {
      const received = T0 + 1_000 + i
      recordValidUpdate(t, POLICY, { receivedAt: received, revision: 1_000 + i, providerTimestamp: received - shift - 40 })
    }
    const f = deriveFreshness(t, T0 + 1_000 + POLICY.skewWindow)
    expect(t.deliveryDelays).toHaveLength(POLICY.skewWindow)
    expect(f).toMatchObject({ state: "fresh", providerLagMs: 0 })
  })

  it("ignores a non-finite provider timestamp", () => {
    const t = liveFeed()
    const before = t.deliveryDelays.length
    recordValidUpdate(t, POLICY, { receivedAt: T0 + 200, revision: 200, providerTimestamp: Number.NaN })
    expect(t.deliveryDelays).toHaveLength(before)
    expect(deriveFreshness(t, T0 + 300).state).toBe("fresh")
  })
})

describe("revision handling", () => {
  it("rejects duplicate and out-of-order revisions without freshening the book", () => {
    const t = liveFeed()
    const revision = t.lastValidRevision
    const at = t.lastValidUpdateAt

    expect(recordValidUpdate(t, POLICY, { receivedAt: T0 + 5_000, revision: 101 })).toBe(false)
    expect(recordValidUpdate(t, POLICY, { receivedAt: T0 + 6_000, revision: 50 })).toBe(false)

    expect(t.lastValidRevision).toBe(revision)
    expect(t.lastValidUpdateAt).toBe(at)
    // The frames still prove the transport is alive.
    expect(t.lastMessageAt).toBe(T0 + 6_000)
  })

  it("accepts a strictly newer revision", () => {
    const t = liveFeed()
    expect(recordValidUpdate(t, POLICY, { receivedAt: T0 + 500, revision: 102 })).toBe(true)
    expect(t.lastValidRevision).toBe(102)
  })

  it("a replayed old revision does not clear a malformed streak", () => {
    const t = liveFeed()
    for (let i = 0; i < 3; i++) recordMalformed(t, T0 + 200 + i)
    recordValidUpdate(t, POLICY, { receivedAt: T0 + 300, revision: 100 })
    expect(deriveFreshness(t, T0 + 301).reason).toBe("malformed-updates")
  })
})

describe("stale depth cannot seed an actionable quote", () => {
  it("quotes from fresh depth", () => {
    expect(quoteFromDepth(book, deriveFreshness(liveFeed(), T0 + 200))).toEqual({
      bid: 99,
      ask: 101,
      mid: 100,
    })
  })

  it.each([
    ["transport silent", (t: FeedTelemetry) => void t, T0 + 100 + POLICY.heartbeatTimeoutMs + 1],
    ["malformed", (t: FeedTelemetry) => { for (let i = 0; i < 3; i++) recordMalformed(t, T0 + 200 + i) }, T0 + 300],
    ["reconnecting", (t: FeedTelemetry) => recordTransport(t, "closed", 1), T0 + 300],
  ])("refuses to quote when %s", (_label, degrade, at) => {
    const t = liveFeed()
    degrade(t)
    expect(quoteFromDepth(book, deriveFreshness(t, at))).toBeNull()
  })

  it("refuses a crossed, empty or nonsensical book even from a fresh feed", () => {
    const fresh = deriveFreshness(liveFeed(), T0 + 200)
    expect(quoteFromDepth({ bids: [{ price: 101, size: 1 }], asks: [{ price: 99, size: 1 }] }, fresh)).toBeNull()
    expect(quoteFromDepth({ bids: [], asks: book.asks }, fresh)).toBeNull()
    expect(quoteFromDepth({ bids: book.bids, asks: [] }, fresh)).toBeNull()
    expect(quoteFromDepth({ bids: [{ price: 0, size: 1 }], asks: book.asks }, fresh)).toBeNull()
    expect(quoteFromDepth({ bids: [{ price: Number.NaN, size: 1 }], asks: book.asks }, fresh)).toBeNull()
  })

  it("refuses before a snapshot even if updates are flowing", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordValidUpdate(t, POLICY, { receivedAt: T0, revision: 9, providerTimestamp: T0 - 10 })
    expect(quoteFromDepth(book, deriveFreshness(t, T0 + 1))).toBeNull()
  })
})

describe("toSourceHealth", () => {
  it("maps each state onto the statuses the badge renders", () => {
    const now = T0 + 300
    const fresh = liveFeed()
    expect(toSourceHealth(deriveFreshness(fresh, now), fresh, now)).toMatchObject({
      status: "connected",
      isExecutable: true,
    })

    const silent = liveFeed()
    const later = T0 + 100 + POLICY.heartbeatTimeoutMs + 5_000
    expect(toSourceHealth(deriveFreshness(silent, later), silent, later)).toMatchObject({
      status: "stale",
      isExecutable: false,
    })

    const closed = liveFeed()
    recordTransport(closed, "closed", 2)
    expect(toSourceHealth(deriveFreshness(closed, now), closed, now)).toMatchObject({
      status: "reconnecting",
      reconnectAttempt: 2,
      message: "Reconnecting (attempt 2)…",
    })

    const fresh0 = createTelemetry()
    expect(toSourceHealth(deriveFreshness(fresh0, now), fresh0, now).status).toBe("initial-load")

    const expired = liveFeed()
    recordTransport(expired, "closed", 6)
    const gone = T0 + 100 + POLICY.expireAfterMs + 1
    expect(toSourceHealth(deriveFreshness(expired, gone), expired, gone).status).toBe("error")
  })

  it("explains why a feed is stale", () => {
    const t = liveFeed()
    for (let i = 0; i < 3; i++) recordMalformed(t, T0 + 200 + i)
    expect(toSourceHealth(deriveFreshness(t, T0 + 300), t, T0 + 300).message).toMatch(/invalid updates/)
  })

  it("does not call a quiet market a problem", () => {
    const t = liveFeed()
    recordMessage(t, T0 + 40_000)
    const h = toSourceHealth(deriveFreshness(t, T0 + 41_000), t, T0 + 41_000)
    expect(h).toMatchObject({ status: "connected", isExecutable: true })
    expect(h.message).toMatch(/no recent book changes/)
  })
})
