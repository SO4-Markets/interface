// OB-050: deterministic feed replay for the conformance suite (test support).
//
// A scenario is a list of steps a feed can produce. `replayFeed` folds them
// through the production `bookReducer`; `oracleBook` computes the expected
// final book by a different route (plain maps, revisions sorted and de-duplicated
// up front), so a bug in the reducer cannot make the expectation wrong the same way.

import {
  
  
  
  
  
  askLevels,
  bidLevels,
  bookReducer,
  createBookState
} from "../book-reducer"
import type {BookAction, BookDelta, BookLevel, BookSnapshot, BookState} from "../book-reducer";

export type FeedStep =
  | { kind: "snapshot"; snapshot: BookSnapshot }
  | { kind: "delta"; delta: BookDelta }
  /** The transport dropped: whatever the client held is no longer trustworthy. */
  | { kind: "disconnect" }

export type ReplayTrace = {
  state: BookState
  /** The book state after every step, for asserting what was visible along the way. */
  states: Array<BookState>
}

function toAction(step: FeedStep): BookAction {
  switch (step.kind) {
    case "snapshot":
      return { type: "snapshot", snapshot: step.snapshot }
    case "delta":
      return { type: "delta", delta: step.delta }
    case "disconnect":
      // A reconnecting client discards its book and waits for a fresh snapshot.
      return { type: "reset" }
  }
}

export function replayFeed(steps: ReadonlyArray<FeedStep>): ReplayTrace {
  let state = createBookState()
  const states: Array<BookState> = []
  for (const step of steps) {
    state = bookReducer(state, toAction(step))
    states.push(state)
  }
  return { state, states }
}

export type BookView = {
  revision: bigint
  bids: Array<BookLevel>
  asks: Array<BookLevel>
}

function apply(side: Map<bigint, bigint>, levels: ReadonlyArray<BookLevel>) {
  for (const { price, size } of levels) {
    if (size <= 0n) side.delete(price)
    else side.set(price, size)
  }
}

const bestFirst = (side: Map<bigint, bigint>, descending: boolean): Array<BookLevel> =>
  [...side.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (a.price === b.price ? 0 : (a.price < b.price) === descending ? 1 : -1))

/**
 * The book a correct client must end up with: start from the LATEST snapshot,
 * then apply every distinct delta above its revision, in revision order. Assumes
 * the deltas cover a contiguous range (the caller decides that; a scenario with a
 * hole is expressed by ending on a snapshot instead).
 */
export function oracleBook(
  snapshots: ReadonlyArray<BookSnapshot>,
  deltas: ReadonlyArray<BookDelta>
): BookView {
  const base = snapshots.reduce((best, s) => (s.revision > best.revision ? s : best))
  const bids = new Map<bigint, bigint>()
  const asks = new Map<bigint, bigint>()
  apply(bids, base.bids)
  apply(asks, base.asks)

  const byRevision = new Map<bigint, BookDelta>()
  for (const delta of deltas) byRevision.set(delta.revision, delta)
  const ordered = [...byRevision.values()].filter((d) => d.revision > base.revision).sort((a, b) => (a.revision < b.revision ? -1 : 1))

  let revision = base.revision
  for (const delta of ordered) {
    apply(bids, delta.bids)
    apply(asks, delta.asks)
    revision = delta.revision
  }
  return { revision, bids: bestFirst(bids, true), asks: bestFirst(asks, false) }
}

/** The reducer's book in the same shape as `oracleBook`, for direct comparison. */
export function viewOf(state: BookState): BookView {
  return { revision: state.revision ?? -1n, bids: bidLevels(state), asks: askLevels(state) }
}

/** Small seeded PRNG so "random" scenarios are identical on every run and machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: ReadonlyArray<T>, random: () => number): Array<T> {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
