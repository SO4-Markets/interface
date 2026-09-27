import { describe, expect, it } from "vitest"
import {
  askLevels,
  bidLevels,
  bookReducer,
  createBookState,
} from "./book-reducer"
import type {
  BookAction,
  BookDelta,
  BookLevel,
  BookSnapshot,
} from "./book-reducer"

const lv = (price: number, size: number): BookLevel => ({
  price: BigInt(price),
  size: BigInt(size),
})

const snapshot = (revision: number): BookSnapshot => ({
  revision: BigInt(revision),
  bids: [lv(100, 5), lv(99, 3)],
  asks: [lv(101, 4), lv(102, 2)],
})

const delta = (
  revision: number,
  bids: Array<BookLevel> = [],
  asks: Array<BookLevel> = []
): BookDelta => ({ revision: BigInt(revision), bids, asks })

const run = (actions: Array<BookAction>) =>
  actions.reduce(bookReducer, createBookState())

describe("bookReducer", () => {
  it("starts non-actionable and awaiting a snapshot", () => {
    const state = createBookState()
    expect(state.status).toBe("awaiting_snapshot")
    expect(state.actionable).toBe(false)
    expect(state.revision).toBeNull()
  })

  it("loads a snapshot and becomes actionable", () => {
    const state = run([{ type: "snapshot", snapshot: snapshot(10) }])
    expect(state.status).toBe("live")
    expect(state.actionable).toBe(true)
    expect(state.revision).toBe(10n)
    expect(bidLevels(state)).toEqual([lv(100, 5), lv(99, 3)])
    expect(askLevels(state)).toEqual([lv(101, 4), lv(102, 2)])
  })

  it("drops zero-size levels from a snapshot", () => {
    const state = run([
      {
        type: "snapshot",
        snapshot: { revision: 1n, bids: [lv(100, 0), lv(99, 1)], asks: [] },
      },
    ])
    expect(bidLevels(state)).toEqual([lv(99, 1)])
  })

  it("applies a contiguous delta: replace, add and remove", () => {
    const state = run([
      { type: "snapshot", snapshot: snapshot(10) },
      {
        type: "delta",
        delta: delta(11, [lv(100, 0), lv(98, 7)], [lv(101, 9)]),
      },
    ])
    expect(state.revision).toBe(11n)
    expect(bidLevels(state)).toEqual([lv(99, 3), lv(98, 7)])
    expect(askLevels(state)).toEqual([lv(101, 9), lv(102, 2)])
    expect(state.actionable).toBe(true)
  })

  it("ignores duplicate and stale deltas without changing the book", () => {
    const base = run([
      { type: "snapshot", snapshot: snapshot(10) },
      { type: "delta", delta: delta(11, [lv(100, 6)]) },
    ])
    const dup = bookReducer(base, {
      type: "delta",
      delta: delta(11, [lv(100, 1)]),
    })
    const stale = bookReducer(dup, {
      type: "delta",
      delta: delta(9, [lv(100, 1)]),
    })
    expect(bidLevels(stale)).toEqual(bidLevels(base))
    expect(stale.revision).toBe(11n)
    expect(stale.ignored).toBe(2)
    expect(stale.actionable).toBe(true)
  })

  it("enters a gap state on a revision hole and stays non-actionable", () => {
    const state = run([
      { type: "snapshot", snapshot: snapshot(10) },
      { type: "delta", delta: delta(12, [lv(100, 1)]) },
    ])
    expect(state.status).toBe("gap")
    expect(state.actionable).toBe(false)
    expect(state.gap).toEqual({ expected: 11n, received: 12n })
    // The out-of-sequence delta must not have been applied.
    expect(bidLevels(state)[0]).toEqual(lv(100, 5))
  })

  it("stays non-actionable on later deltas until a fresh snapshot", () => {
    const gapped = run([
      { type: "snapshot", snapshot: snapshot(10) },
      { type: "delta", delta: delta(12) },
      { type: "delta", delta: delta(13) },
      { type: "delta", delta: delta(13) },
    ])
    expect(gapped.status).toBe("gap")
    expect(gapped.actionable).toBe(false)
    expect(gapped.revision).toBe(10n)
    expect(gapped.buffered.map((d) => d.revision)).toEqual([13n])
  })

  it("recovers from a gap when a fresh snapshot is reconciled", () => {
    const state = run([
      { type: "snapshot", snapshot: snapshot(10) },
      { type: "delta", delta: delta(12) },
      { type: "snapshot", snapshot: snapshot(20) },
    ])
    expect(state.status).toBe("live")
    expect(state.actionable).toBe(true)
    expect(state.gap).toBeNull()
    expect(state.revision).toBe(20n)
  })

  it("buffers deltas that arrive during the snapshot fetch and replays them", () => {
    const state = run([
      { type: "delta", delta: delta(11, [lv(100, 8)]) },
      { type: "delta", delta: delta(12, [], [lv(101, 0)]) },
      { type: "snapshot", snapshot: snapshot(10) },
    ])
    expect(state.status).toBe("live")
    expect(state.revision).toBe(12n)
    expect(bidLevels(state)[0]).toEqual(lv(100, 8))
    expect(askLevels(state)).toEqual([lv(102, 2)])
    expect(state.buffered).toEqual([])
  })

  it("replays buffered deltas that arrived out of order", () => {
    const state = run([
      { type: "delta", delta: delta(12, [lv(99, 1)]) },
      { type: "delta", delta: delta(11, [lv(100, 9)]) },
      { type: "snapshot", snapshot: snapshot(10) },
    ])
    expect(state.revision).toBe(12n)
    expect(bidLevels(state)).toEqual([lv(100, 9), lv(99, 1)])
  })

  it("drops buffered deltas already included in the snapshot", () => {
    const state = run([
      { type: "delta", delta: delta(9, [lv(100, 1)]) },
      { type: "delta", delta: delta(10, [lv(100, 2)]) },
      { type: "delta", delta: delta(11, [lv(99, 6)]) },
      { type: "snapshot", snapshot: snapshot(10) },
    ])
    expect(state.status).toBe("live")
    expect(state.revision).toBe(11n)
    expect(bidLevels(state)).toEqual([lv(100, 5), lv(99, 6)])
    expect(state.ignored).toBe(2)
  })

  it("collapses duplicate buffered deltas while awaiting a snapshot", () => {
    const state = run([
      { type: "delta", delta: delta(11, [lv(100, 8)]) },
      { type: "delta", delta: delta(11, [lv(100, 8)]) },
    ])
    expect(state.buffered).toHaveLength(1)
    expect(state.ignored).toBe(1)
  })

  it("reports a gap when buffered deltas do not follow the snapshot", () => {
    const state = run([
      { type: "delta", delta: delta(13) },
      { type: "snapshot", snapshot: snapshot(10) },
    ])
    expect(state.status).toBe("gap")
    expect(state.actionable).toBe(false)
    expect(state.gap).toEqual({ expected: 11n, received: 13n })
  })

  it("ignores a snapshot older than the live book", () => {
    const live = run([{ type: "snapshot", snapshot: snapshot(10) }])
    const state = bookReducer(live, {
      type: "snapshot",
      snapshot: { revision: 5n, bids: [lv(1, 1)], asks: [] },
    })
    expect(state.revision).toBe(10n)
    expect(bidLevels(state)).toEqual(bidLevels(live))
    expect(state.ignored).toBe(1)
  })

  it("does not mutate the previous state", () => {
    const before = run([{ type: "snapshot", snapshot: snapshot(10) }])
    const bidsBefore = bidLevels(before)
    bookReducer(before, { type: "delta", delta: delta(11, [lv(100, 0)]) })
    expect(bidLevels(before)).toEqual(bidsBefore)
    expect(before.revision).toBe(10n)
  })

  it("resets to the initial state", () => {
    const state = run([
      { type: "snapshot", snapshot: snapshot(10) },
      { type: "reset" },
    ])
    expect(state).toEqual(createBookState())
  })

  it("converges to the same book regardless of buffering vs live application", () => {
    const deltas = [
      delta(11, [lv(100, 2)]),
      delta(12, [lv(98, 4)], [lv(101, 0)]),
      delta(13, [lv(100, 0)], [lv(103, 1)]),
    ]
    const live = run([
      { type: "snapshot", snapshot: snapshot(10) },
      ...deltas.map((d): BookAction => ({ type: "delta", delta: d })),
    ])
    const buffered = run([
      ...deltas.map((d): BookAction => ({ type: "delta", delta: d })),
      { type: "snapshot", snapshot: snapshot(10) },
    ])
    expect(bidLevels(buffered)).toEqual(bidLevels(live))
    expect(askLevels(buffered)).toEqual(askLevels(live))
    expect(buffered.revision).toBe(live.revision)
  })
})
