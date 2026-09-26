// OB-050: feed replay and execution conformance.
//
// Every test here is a MOCKED, deterministic test over fixtures built in this
// file. Nothing talks to a venue or an indexer. See README.md in this directory
// for the versions covered and for what has NOT been verified against a live
// upstream.

import { describe, expect, it } from "vitest"
import { buildDepth } from "../depth"
import {
  DEFAULT_FRESHNESS_POLICY as POLICY,
  createTelemetry,
  deriveFreshness,
  recordMessage,
  recordSnapshot,
  recordTransport,
  recordValidUpdate,
  resetSnapshot,
} from "../../source-freshness"
import {  foldOrderEvents } from "./order-fold"
import {  mulberry32, oracleBook, replayFeed, shuffled, viewOf } from "./feed-replay"
import type {OrderEvent} from "./order-fold";
import type {FeedStep} from "./feed-replay";
import type { BookDelta, BookLevel, BookSnapshot } from "../book-reducer"

const L = (price: bigint, size: bigint): BookLevel => ({ price, size })

const snap = (revision: bigint, bids: Array<BookLevel>, asks: Array<BookLevel>): BookSnapshot => ({ revision, bids, asks })
const delta = (revision: bigint, bids: Array<BookLevel> = [], asks: Array<BookLevel> = []): BookDelta => ({ revision, bids, asks })

// A short, hand-checkable book history. Prices are integer atoms.
const S100 = snap(100n, [L(100n, 5n), L(99n, 4n)], [L(101n, 5n), L(102n, 4n)])
const D101 = delta(101n, [L(100n, 7n)], [])
const D102 = delta(102n, [], [L(101n, 0n), L(103n, 9n)]) // removes 101, adds 103
const D103 = delta(103n, [L(98n, 3n), L(99n, 0n)], [])
const D104 = delta(104n, [L(100n, 0n)], [L(102n, 6n)])
const D105 = delta(105n, [L(100n, 2n)], [])
const ALL = [D101, D102, D103, D104, D105]

const step = (d: BookDelta): FeedStep => ({ kind: "delta", delta: d })
const snapStep = (s: BookSnapshot): FeedStep => ({ kind: "snapshot", snapshot: s })

describe("baseline: the oracle agrees with the reducer on a clean stream", () => {
  it("converges to the oracle book, live and actionable", () => {
    const { state } = replayFeed([snapStep(S100), ...ALL.map(step)])
    expect(viewOf(state)).toEqual(oracleBook([S100], ALL))
    expect(state).toMatchObject({ status: "live", actionable: true, revision: 105n, ignored: 0 })
  })

  it("hand-checked final book", () => {
    const { state } = replayFeed([snapStep(S100), ...ALL.map(step)])
    // 100: 5 -> 7 -> 0 -> 2 ; 99 removed at 103 ; 98 added at 103
    expect(viewOf(state).bids).toEqual([L(100n, 2n), L(98n, 3n)])
    // 101 removed at 102 ; 103 added ; 102: 4 -> 6
    expect(viewOf(state).asks).toEqual([L(102n, 6n), L(103n, 9n)])
  })
})

describe("duplicates", () => {
  it("every delta delivered two or three times converges and stays actionable", () => {
    const steps: Array<FeedStep> = [snapStep(S100)]
    ALL.forEach((d, i) => {
      steps.push(step(d), step(d))
      if (i % 2 === 0) steps.push(step(d))
    })
    const { state } = replayFeed(steps)
    expect(viewOf(state)).toEqual(oracleBook([S100], ALL))
    expect(state.actionable).toBe(true)
    // 5 deltas: 2 extra copies each, +1 for the three that were sent three times.
    expect(state.ignored).toBe(5 + 3)
  })

  it("a duplicated snapshot changes nothing", () => {
    const { state } = replayFeed([snapStep(S100), snapStep(S100), ...ALL.map(step), snapStep(S100)])
    // The last (older) snapshot is ignored once the book is live and ahead of it.
    expect(viewOf(state)).toEqual(oracleBook([S100], ALL))
  })

  it("duplicates buffered before the snapshot are collapsed", () => {
    const { state } = replayFeed([step(D101), step(D101), step(D102), snapStep(S100)])
    expect(viewOf(state)).toEqual(oracleBook([S100], [D101, D102]))
    expect(state.status).toBe("live")
  })
})

describe("disconnect and reconnect", () => {
  it("is not actionable from the disconnect until a fresh snapshot is applied", () => {
    const trace = replayFeed([
      snapStep(S100),
      step(D101),
      step(D102),
      { kind: "disconnect" },
      step(D103), // arrives on the new connection before its snapshot
      step(D104),
    ])
    expect(trace.states[2].actionable).toBe(true)
    for (const s of trace.states.slice(3)) expect(s.actionable).toBe(false)
    expect(trace.state.status).toBe("awaiting_snapshot")
    expect(trace.state.bids.size + trace.state.asks.size).toBe(0) // no stale book is kept
  })

  it("converges to the authoritative book once the reconnect snapshot arrives", () => {
    const reconnectSnapshot = snap(103n, [L(100n, 7n), L(98n, 3n)], [L(102n, 4n), L(103n, 9n)])
    const { state } = replayFeed([
      snapStep(S100),
      step(D101),
      { kind: "disconnect" },
      step(D103),
      step(D104),
      step(D105),
      snapStep(reconnectSnapshot),
    ])
    expect(state).toMatchObject({ status: "live", actionable: true, revision: 105n })
    expect(viewOf(state)).toEqual(oracleBook([reconnectSnapshot], [D104, D105]))
  })

  it("drops buffered deltas the reconnect snapshot already includes", () => {
    const covering = snap(104n, [L(98n, 3n)], [L(102n, 6n), L(103n, 9n)])
    const { state } = replayFeed([{ kind: "disconnect" }, step(D101), step(D103), step(D104), step(D105), snapStep(covering)])
    expect(state.revision).toBe(105n)
    expect(state.ignored).toBeGreaterThanOrEqual(3)
    expect(viewOf(state)).toEqual(oracleBook([covering], [D105]))
  })

  it("repeated disconnects each start clean", () => {
    const { state } = replayFeed([
      snapStep(S100),
      { kind: "disconnect" },
      { kind: "disconnect" },
      snapStep(S100),
      ...ALL.map(step),
    ])
    expect(viewOf(state)).toEqual(oracleBook([S100], ALL))
  })

  it("freshness agrees: no quote-able depth while disconnected, again after the snapshot", () => {
    const t = createTelemetry()
    recordTransport(t, "open")
    recordSnapshot(t, 1_000, 100)
    recordValidUpdate(t, POLICY, { receivedAt: 1_100, revision: 101, providerTimestamp: 1_060 })
    expect(deriveFreshness(t, 1_200).canSeedQuote).toBe(true)

    recordTransport(t, "closed", 1)
    resetSnapshot(t)
    expect(deriveFreshness(t, 2_000).canSeedQuote).toBe(false)

    recordTransport(t, "open", 0)
    recordMessage(t, 3_000)
    expect(deriveFreshness(t, 3_001)).toMatchObject({ state: "unavailable", reason: "awaiting-snapshot", canSeedQuote: false })

    recordSnapshot(t, 3_100, 103)
    expect(deriveFreshness(t, 3_200).canSeedQuote).toBe(true)
  })
})

describe("missing revisions", () => {
  it("a hole makes the book non-actionable and reports exactly what was expected", () => {
    const { state } = replayFeed([snapStep(S100), step(D101), step(D103)]) // 102 never arrives
    expect(state).toMatchObject({ status: "gap", actionable: false })
    expect(state.gap).toEqual({ expected: 102n, received: 103n })
  })

  it("does not apply anything past the hole, so the last good book is not corrupted", () => {
    const good = replayFeed([snapStep(S100), step(D101)]).state
    const { state } = replayFeed([snapStep(S100), step(D101), step(D103), step(D104)])
    expect(viewOf(state).bids).toEqual(viewOf(good).bids)
    expect(viewOf(state).asks).toEqual(viewOf(good).asks)
    expect(state.revision).toBe(101n)
  })

  it("a late arrival of the missing revision does not repair a gap on its own", () => {
    const { state } = replayFeed([snapStep(S100), step(D101), step(D103), step(D102)])
    expect(state.status).toBe("gap")
    expect(state.actionable).toBe(false)
  })

  it("recovers only through a snapshot, and converges to the authoritative book", () => {
    const recovery = snap(104n, [L(98n, 3n)], [L(102n, 6n), L(103n, 9n)])
    const { state } = replayFeed([snapStep(S100), step(D101), step(D103), step(D105), snapStep(recovery)])
    expect(state).toMatchObject({ status: "live", actionable: true, revision: 105n })
    expect(viewOf(state)).toEqual(oracleBook([recovery], [D105]))
  })

  it("a recovery snapshot that still leaves a hole stays non-actionable", () => {
    const short = snap(101n, [L(100n, 7n), L(99n, 4n)], [L(101n, 5n), L(102n, 4n)])
    const { state } = replayFeed([snapStep(S100), step(D101), step(D103), step(D105), snapStep(short)])
    // 102 and 104 are still missing relative to what was buffered.
    expect(state.actionable).toBe(false)
  })

  it("a gap never yields a quote-able book by any later delta", () => {
    const { states } = replayFeed([snapStep(S100), step(D101), step(D103), step(D104), step(D105)])
    for (const s of states.slice(2)) expect(s.actionable).toBe(false)
  })
})

describe("partial fills are not fully filled", () => {
  const created = (size = 100): OrderEvent => ({ eventId: "e1", sequence: 1, type: "created", sizeUsd: size })
  const fill = (id: string, seq: number, size: number): OrderEvent => ({ eventId: id, sequence: seq, type: "fill", sizeUsd: size })

  it("a partial fill is presented as partially filled, never filled", () => {
    const v = foldOrderEvents([created(), fill("f1", 2, 40)])
    expect(v).toMatchObject({ stage: "partially-filled", filledSizeUsd: 40, originalSizeUsd: 100 })
  })

  it("fills that sum to the order size complete it", () => {
    const v = foldOrderEvents([created(), fill("f1", 2, 40), fill("f2", 3, 60)])
    expect(v).toMatchObject({ stage: "filled", filledSizeUsd: 100 })
  })

  it("a duplicated fill event is counted once, so it cannot fake completion", () => {
    const v = foldOrderEvents([created(), fill("f1", 2, 60), fill("f1", 2, 60)])
    expect(v).toMatchObject({ stage: "partially-filled", filledSizeUsd: 60, duplicates: 1 })
  })

  it("an order the indexer has not reported is pending, not accepted or filled", () => {
    expect(foldOrderEvents([fill("f1", 2, 10)]).stage).toBe("pending")
  })

  it("an over-fill is capped at the order size", () => {
    const v = foldOrderEvents([created(), fill("f1", 2, 70), fill("f2", 3, 70)])
    expect(v).toMatchObject({ stage: "filled", filledSizeUsd: 100 })
  })
})

describe("cancellation races converge to the authoritative outcome", () => {
  const created: OrderEvent = { eventId: "e1", sequence: 1, type: "created", sizeUsd: 100 }
  const fill = (id: string, seq: number, size: number): OrderEvent => ({ eventId: id, sequence: seq, type: "fill", sizeUsd: size })
  const cancelReq: OrderEvent = { eventId: "c1", sequence: 3, type: "cancel-requested" }

  it("cancel requested while resting is shown as pending cancellation, never as cancelled", () => {
    expect(foldOrderEvents([created, cancelReq]).stage).toBe("pending-cancellation")
  })

  it("cancel confirmed before the rest fills: cancelled, and the partial fill is kept", () => {
    const v = foldOrderEvents([created, fill("f1", 2, 30), cancelReq, { eventId: "c2", sequence: 4, type: "cancel-confirmed" }])
    expect(v).toMatchObject({ stage: "cancelled", filledSizeUsd: 30 })
  })

  it("the rest fills before the cancel is sequenced: filled, and the cancel is a no-op", () => {
    const v = foldOrderEvents([
      created,
      fill("f1", 2, 30),
      fill("f2", 3, 70), // sequenced before the cancel request below
      { eventId: "c1", sequence: 4, type: "cancel-requested" },
      { eventId: "c2", sequence: 5, type: "cancel-confirmed" },
    ])
    expect(v).toMatchObject({ stage: "filled", filledSizeUsd: 100 })
  })

  it("a cancel rejected by the venue returns the order to its resting stage", () => {
    const v = foldOrderEvents([created, fill("f1", 2, 30), cancelReq, { eventId: "c2", sequence: 4, type: "cancel-rejected" }])
    expect(v.stage).toBe("partially-filled")
  })

  it("a fill sequenced after the order was cancelled is not counted", () => {
    const v = foldOrderEvents([
      created,
      { eventId: "c1", sequence: 2, type: "cancel-requested" },
      { eventId: "c2", sequence: 3, type: "cancel-confirmed" },
      fill("late", 4, 50),
    ])
    expect(v).toMatchObject({ stage: "cancelled", filledSizeUsd: 0 })
  })

  it("never claims filled for an order whose remainder was cancelled", () => {
    const v = foldOrderEvents([created, fill("f1", 2, 99), cancelReq, { eventId: "c2", sequence: 4, type: "cancel-confirmed" }])
    expect(v.stage).toBe("cancelled")
    expect(v.filledSizeUsd).toBeLessThan(v.originalSizeUsd)
  })

  // The strongest check: however the events reach us, the outcome is the same.
  function permutations<T>(items: ReadonlyArray<T>): Array<Array<T>> {
    if (items.length <= 1) return [[...items]]
    return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]))
  }

  it.each([
    ["fill wins the race", [created, fill("f1", 2, 40), fill("f2", 3, 60), { eventId: "c1", sequence: 4, type: "cancel-requested" }, { eventId: "c2", sequence: 5, type: "cancel-confirmed" }], "filled"],
    ["cancel wins the race", [created, fill("f1", 2, 40), { eventId: "c1", sequence: 3, type: "cancel-requested" }, { eventId: "c2", sequence: 4, type: "cancel-confirmed" }, fill("late", 5, 60)], "cancelled"],
    ["cancel rejected", [created, fill("f1", 2, 40), { eventId: "c1", sequence: 3, type: "cancel-requested" }, { eventId: "c2", sequence: 4, type: "cancel-rejected" }], "partially-filled"],
  ] as Array<[string, Array<OrderEvent>, string]>)("%s: every one of the arrival orders gives the same final state", (_label, events, expected) => {
    const outcomes = new Set<string>()
    for (const arrival of permutations(events)) {
      const v = foldOrderEvents(arrival)
      outcomes.add(`${v.stage}|${v.filledSizeUsd}`)
    }
    expect(outcomes.size).toBe(1)
    expect([...outcomes][0].split("|")[0]).toBe(expected)
  })

  it("duplicating every event in any order still converges", () => {
    const events: Array<OrderEvent> = [created, fill("f1", 2, 40), fill("f2", 3, 60)]
    const doubled = [...events, ...events]
    for (const arrival of permutations(doubled).slice(0, 200)) {
      expect(foldOrderEvents(arrival)).toMatchObject({ stage: "filled", filledSizeUsd: 100 })
    }
  })
})

describe("randomized convergence (seeded, deterministic)", () => {
  function randomHistory(seed: number, count: number) {
    const random = mulberry32(seed)
    const level = () => L(90n + BigInt(Math.floor(random() * 20)), BigInt(Math.floor(random() * 6))) // size 0 removes
    const deltas: Array<BookDelta> = []
    for (let i = 1; i <= count; i++) {
      deltas.push(delta(100n + BigInt(i), [level(), level()], [level(), level()].map((l) => L(l.price + 15n, l.size))))
    }
    return { random, deltas }
  }

  it.each([1, 2, 3, 7, 42, 99, 1234, 20260926])("seed %s: any duplicated, reordered delivery ending in a covering snapshot converges", (seed) => {
    const { random, deltas } = randomHistory(seed, 25)
    const authoritative = oracleBook([S100], deltas)
    const finalSnapshot = snap(
      authoritative.revision,
      authoritative.bids,
      authoritative.asks
    )

    const noisy = shuffled([...deltas, ...deltas.filter(() => random() < 0.5)], random)
    const { state } = replayFeed([snapStep(S100), ...noisy.map(step), snapStep(finalSnapshot)])

    expect(state).toMatchObject({ status: "live", actionable: true, revision: authoritative.revision })
    expect(viewOf(state)).toEqual(authoritative)
  })

  it.each([5, 6, 8, 13])("seed %s: an in-order stream with duplicates interleaved converges without a snapshot", (seed) => {
    const { random, deltas } = randomHistory(seed, 30)
    const steps: Array<FeedStep> = [snapStep(S100)]
    for (const d of deltas) {
      steps.push(step(d))
      while (random() < 0.4) steps.push(step(deltas[Math.floor(random() * deltas.indexOf(d) + 1) - 1] ?? d)) // replay something already seen
    }
    const { state } = replayFeed(steps)
    expect(viewOf(state)).toEqual(oracleBook([S100], deltas))
    expect(state.actionable).toBe(true)
  })

  it.each([3, 11, 21])("seed %s: an unsorted burst buffered before the snapshot replays in revision order", (seed) => {
    const { random, deltas } = randomHistory(seed, 20)
    const { state } = replayFeed([...shuffled(deltas, random).map(step), snapStep(S100)])
    expect(viewOf(state)).toEqual(oracleBook([S100], deltas))
    expect(state.status).toBe("live")
  })

  it("the book never crosses in the fixtures, and the depth spread matches the canonical best prices", () => {
    const { state } = replayFeed([snapStep(S100), ...ALL.map(step)])
    const view = viewOf(state)
    const depth = buildDepth(view.bids, view.asks, { tick: 1n })
    expect(depth.crossed).toBe(false)
    expect(depth.spread).toBe(view.asks[0].price - view.bids[0].price)
  })
})
