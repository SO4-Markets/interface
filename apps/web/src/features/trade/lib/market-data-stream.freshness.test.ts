// OB-049: the shared market subscription must report health from what it
// actually receives. These tests drive the real subscription through a fake
// WebSocket, with the REST depth snapshot served by an explicit MSW handler,
// and control the clock by faking `Date` only (timers stay real, so MSW and
// the stream's own watchdogs are undisturbed).
//
// Mocked-transport tests: nothing here talks to Binance. They pin how the
// stream classifies quiet markets, dead transports, malformed frames and a
// lagging provider; they do not verify the live venue.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { marketSubscriptionManager } from "./market-data-stream"
import { quoteFromDepth } from "./source-freshness"

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterAll(() => server.close())

const T0 = new Date("2026-01-01T00:00:00.000Z").getTime()
const SYMBOL = "FRESHTEST"

class FakeWebSocket {
  static OPEN = 1
  static instances: Array<FakeWebSocket> = []
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((evt: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: Array<string> = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
  }
  // Test helpers
  open() {
    this.onopen?.()
  }
  frame(payload: unknown) {
    this.onmessage?.({ data: typeof payload === "string" ? payload : JSON.stringify(payload) })
  }
  drop() {
    this.onclose?.()
  }
}

function serveSnapshot(lastUpdateId = 100) {
  server.use(
    http.get("https://api.binance.com/api/v3/depth", () =>
      HttpResponse.json({
        lastUpdateId,
        bids: [["99.00", "1"], ["98.00", "2"]],
        asks: [["101.00", "1"], ["102.00", "2"]],
      }),
    ),
  )
}

const ack = (id = 1) => ({ result: null, id })
const depth = (u: number, providerTime?: number) => ({
  e: "depthUpdate",
  ...(providerTime === undefined ? {} : { E: providerTime }),
  u,
  b: [["99.00", "1.5"]],
  a: [],
})

let unsubscribe: (() => void) | null = null

/** Subscribe to the book, connect the fake socket and wait for the snapshot to apply. */
async function connectedFeed() {
  serveSnapshot()
  const shared = marketSubscriptionManager.getOrCreate(SYMBOL)
  unsubscribe = shared.subscribeBook(() => {})
  const ws = FakeWebSocket.instances.at(-1)!
  ws.open()
  await vi.waitFor(() => expect(shared.getBookState().bids.length).toBeGreaterThan(0))
  return { shared, ws }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal("WebSocket", FakeWebSocket)
  vi.useFakeTimers({ toFake: ["Date"], now: T0 })
})

afterEach(() => {
  unsubscribe?.()
  unsubscribe = null
  marketSubscriptionManager.removeInstance(SYMBOL)
  server.resetHandlers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms)

describe("source freshness from the live stream", () => {
  it("is unavailable until the snapshot has been applied", async () => {
    serveSnapshot()
    const shared = marketSubscriptionManager.getOrCreate(SYMBOL)
    unsubscribe = shared.subscribeBook(() => {})
    expect(shared.getFreshness()).toMatchObject({ state: "unavailable", reason: "connecting" })
    expect(shared.getFreshness().canSeedQuote).toBe(false)

    // Let the in-flight snapshot request settle so it cannot outlive this test.
    await vi.waitFor(() => expect(shared.getBookState().bids.length).toBeGreaterThan(0))
  })

  it("is fresh once connected with a snapshot, and can seed a quote from the book", async () => {
    const { shared } = await connectedFeed()
    const freshness = shared.getFreshness()
    expect(freshness).toMatchObject({ state: "fresh", canSeedQuote: true })
    expect(quoteFromDepth(shared.getBookState(), freshness)).toEqual({ bid: 99, ask: 101, mid: 100 })
  })

  it("stays fresh through minutes with no book changes while acks keep arriving (no trades)", async () => {
    const { shared, ws } = await connectedFeed()
    for (let i = 0; i < 24; i++) {
      advance(10_000)
      ws.frame(ack(i + 2))
    }
    const freshness = shared.getFreshness()
    expect(freshness).toMatchObject({ state: "fresh", reason: "quiet-market", canSeedQuote: true })
    expect(freshness.lastValidUpdateAgeMs).toBeGreaterThanOrEqual(240_000)
  })

  it("goes stale when the transport says open but goes silent", async () => {
    const { shared } = await connectedFeed()
    advance(21_000)
    const freshness = shared.getFreshness()
    expect(freshness).toMatchObject({ state: "stale", reason: "transport-silent", canSeedQuote: false })
    expect(quoteFromDepth(shared.getBookState(), freshness)).toBeNull()
  })

  it("is reconnecting after the socket drops, and its stale depth cannot seed a quote", async () => {
    const { shared, ws } = await connectedFeed()
    ws.drop()
    advance(500)
    const freshness = shared.getFreshness()
    expect(freshness).toMatchObject({ state: "reconnecting", canSeedQuote: false })
    expect(shared.getSourceHealth().health.status).toBe("reconnecting")
    expect(quoteFromDepth(shared.getBookState(), freshness)).toBeNull()
  })

  it("counts malformed frames, keeps the last valid book, and reports degraded", async () => {
    const { shared, ws } = await connectedFeed()
    const before = shared.getBookState().bids.map((l) => l.price)

    ws.frame("not json at all")
    ws.frame("null")
    ws.frame({ e: "depthUpdate", u: 101, b: "oops", a: [] }) // wrong shape
    advance(1_000)

    expect(shared.getFreshness()).toMatchObject({
      state: "stale",
      reason: "malformed-updates",
      canSeedQuote: false,
    })
    // The bad frames never touched the book.
    expect(shared.getBookState().bids.map((l) => l.price)).toEqual(before)
    // And the transport is clearly alive: this is not the dead-transport case.
    expect(shared.getFreshness().lastMessageAgeMs).toBeLessThan(2_000)
  })

  it("recovers from a malformed streak with the next valid update", async () => {
    const { shared, ws } = await connectedFeed()
    ws.frame("garbage")
    ws.frame("garbage")
    ws.frame("garbage")
    expect(shared.getFreshness().reason).toBe("malformed-updates")

    ws.frame(depth(101, Date.now() - 30))
    expect(shared.getFreshness()).toMatchObject({ state: "fresh", canSeedQuote: true })
  })

  it("flags a provider that delivers updates far later than their timestamps", async () => {
    const { shared, ws } = await connectedFeed()
    for (let i = 0; i < 4; i++) {
      advance(100)
      ws.frame(depth(101 + i, Date.now() - 30)) // normal ~30ms delivery
    }
    expect(shared.getFreshness().state).toBe("fresh")

    advance(100)
    ws.frame(depth(200, Date.now() - 9_000)) // 9s old on arrival
    expect(shared.getFreshness()).toMatchObject({
      state: "stale",
      reason: "provider-lagging",
      canSeedQuote: false,
    })
  })

  it("does not read a constant clock offset as lag", async () => {
    const { shared, ws } = await connectedFeed()
    const offset = 15 * 60_000 // provider clock 15 minutes behind ours
    for (let i = 0; i < 6; i++) {
      advance(100)
      ws.frame(depth(101 + i, Date.now() - offset - 30))
    }
    expect(shared.getFreshness()).toMatchObject({ state: "fresh", providerLagMs: 0 })
  })

  it("ignores a replayed old revision for freshness", async () => {
    const { shared, ws } = await connectedFeed()
    ws.frame(depth(150, Date.now() - 30))
    advance(15_000)
    ws.frame(depth(120, Date.now() - 30)) // older revision replayed
    const freshness = shared.getFreshness()
    // The replay proves the transport is alive but does not make the book newer.
    expect(freshness.lastMessageAgeMs).toBe(0)
    expect(freshness.lastValidUpdateAgeMs).toBe(15_000)
  })

  it("requires a fresh snapshot after a reconnect before depth may seed a quote again", async () => {
    const { shared, ws } = await connectedFeed()
    ws.drop()
    // Reconnect: a new socket opens and the depth snapshot is refetched.
    serveSnapshot(500)
    vi.useRealTimers()
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1), { timeout: 3_000 })
    vi.useFakeTimers({ toFake: ["Date"], now: T0 + 1_000 })

    const next = FakeWebSocket.instances.at(-1)!
    next.open()
    // Between the socket opening and the snapshot landing, depth is unusable.
    expect(shared.getFreshness()).toMatchObject({ state: "unavailable", reason: "awaiting-snapshot" })

    await vi.waitFor(() => expect(shared.getFreshness().canSeedQuote).toBe(true))
    expect(shared.getFreshness().state).toBe("fresh")
  })
})
