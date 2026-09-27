// OB-045: pure snapshot-plus-delta reconciliation for a level-2 order book.
//
// Prices and sizes are exact integer atoms (`bigint`) produced by the price and
// size normalizer (OB-044), so no floating point ever reaches the book.
//
// Ordering model: every message carries a strictly increasing integer
// `revision`, and a delta at revision N is only valid directly after revision
// N-1. Anything the reducer cannot prove is contiguous makes the book
// non-actionable (`actionable: false`) until a fresh snapshot is reconciled.
// The reducer never claims continuity it cannot establish.

export type BookLevel = {
  price: bigint
  size: bigint
}

export type BookSnapshot = {
  revision: bigint
  bids: ReadonlyArray<BookLevel>
  asks: ReadonlyArray<BookLevel>
}

export type BookDelta = {
  revision: bigint
  bids: ReadonlyArray<BookLevel>
  asks: ReadonlyArray<BookLevel>
}

export type BookStatus = "awaiting_snapshot" | "live" | "gap"

export type BookGap = {
  /** Revision the book expected next. */
  expected: bigint
  /** Revision that arrived instead. */
  received: bigint
}

export type BookState = {
  status: BookStatus
  /** True only while the book is provably continuous and safe to act on. */
  actionable: boolean
  /** Last revision applied, or null before any snapshot is reconciled. */
  revision: bigint | null
  bids: ReadonlyMap<bigint, bigint>
  asks: ReadonlyMap<bigint, bigint>
  /** Deltas received while waiting for a snapshot, applied on handoff. */
  buffered: ReadonlyArray<BookDelta>
  /** Set when status is "gap"; describes the discontinuity. */
  gap: BookGap | null
  /** Count of stale or duplicate deltas ignored, for diagnostics. */
  ignored: number
}

export type BookAction =
  | { type: "snapshot"; snapshot: BookSnapshot }
  | { type: "delta"; delta: BookDelta }
  | { type: "reset" }

export function createBookState(): BookState {
  return {
    status: "awaiting_snapshot",
    actionable: false,
    revision: null,
    bids: new Map(),
    asks: new Map(),
    buffered: [],
    gap: null,
    ignored: 0,
  }
}

function toMap(levels: ReadonlyArray<BookLevel>): Map<bigint, bigint> {
  const map = new Map<bigint, bigint>()
  for (const { price, size } of levels) {
    if (size > 0n) map.set(price, size)
  }
  return map
}

function applyLevels(
  side: ReadonlyMap<bigint, bigint>,
  levels: ReadonlyArray<BookLevel>
): Map<bigint, bigint> {
  const next = new Map(side)
  for (const { price, size } of levels) {
    // Quantity zero removes the level; anything else replaces it.
    if (size <= 0n) next.delete(price)
    else next.set(price, size)
  }
  return next
}

function gapState(
  state: BookState,
  expected: bigint,
  received: bigint
): BookState {
  return {
    ...state,
    status: "gap",
    actionable: false,
    buffered: [],
    gap: { expected, received },
  }
}

/** Apply buffered deltas on top of a freshly loaded snapshot. */
function reconcile(
  snapshot: BookSnapshot,
  buffered: ReadonlyArray<BookDelta>,
  ignored: number
): BookState {
  let state: BookState = {
    status: "live",
    actionable: true,
    revision: snapshot.revision,
    bids: toMap(snapshot.bids),
    asks: toMap(snapshot.asks),
    buffered: [],
    gap: null,
    ignored,
  }

  const pending = [...buffered].sort((a, b) =>
    a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0
  )
  for (const delta of pending) {
    state = applyLive(state, delta)
    if (state.status === "gap") return state
  }
  return state
}

function applyLive(state: BookState, delta: BookDelta): BookState {
  const current = state.revision as bigint
  if (delta.revision <= current) {
    // Duplicate or out-of-order replay of something already reflected.
    return { ...state, ignored: state.ignored + 1 }
  }
  const expected = current + 1n
  if (delta.revision !== expected) {
    return gapState(state, expected, delta.revision)
  }
  return {
    ...state,
    revision: delta.revision,
    bids: applyLevels(state.bids, delta.bids),
    asks: applyLevels(state.asks, delta.asks),
  }
}

export function bookReducer(state: BookState, action: BookAction): BookState {
  switch (action.type) {
    case "reset":
      return createBookState()

    case "snapshot": {
      // A snapshot older than what is already live carries no new information.
      if (
        state.status === "live" &&
        state.revision !== null &&
        action.snapshot.revision < state.revision
      ) {
        return { ...state, ignored: state.ignored + 1 }
      }
      // Drop buffered deltas the snapshot already includes, then replay the
      // remainder. A hole between the snapshot and the first survivor is a gap.
      const survivors = state.buffered.filter(
        (delta) => delta.revision > action.snapshot.revision
      )
      const dropped = state.buffered.length - survivors.length
      return reconcile(action.snapshot, survivors, state.ignored + dropped)
    }

    case "delta": {
      if (state.status === "awaiting_snapshot") {
        // Buffer during snapshot fetch; duplicates of a buffered revision are
        // collapsed so replay stays deterministic.
        if (state.buffered.some((d) => d.revision === action.delta.revision)) {
          return { ...state, ignored: state.ignored + 1 }
        }
        return { ...state, buffered: [...state.buffered, action.delta] }
      }
      if (state.status === "gap") {
        // Non-actionable until a fresh snapshot; keep the buffer for handoff.
        if (state.buffered.some((d) => d.revision === action.delta.revision)) {
          return { ...state, ignored: state.ignored + 1 }
        }
        return { ...state, buffered: [...state.buffered, action.delta] }
      }
      return applyLive(state, action.delta)
    }
  }
}

/** Bids best-first (descending price). */
export function bidLevels(state: BookState): Array<BookLevel> {
  return [...state.bids.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (a.price < b.price ? 1 : a.price > b.price ? -1 : 0))
}

/** Asks best-first (ascending price). */
export function askLevels(state: BookState): Array<BookLevel> {
  return [...state.asks.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0))
}
