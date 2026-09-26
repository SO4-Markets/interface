---
pr: TBD
area: performance
breaking: false
---

# Dense book/tape rendering with coalesced updates

**OB-119**: Optimized order book and recent trades rendering to handle high-frequency WebSocket updates without flooding React with re-renders. Introduced frame-coalesced publishing, memoized row components with stable keys, and verified delta reconciliation correctness under burst arrivals.

## Changes

- **Frame-coalesced publishing**: `useOrderBook` now uses `requestAnimationFrame` to batch WebSocket deltas into at most one React render per frame. Previously, every delta triggered immediate `publish()`, causing unnecessary re-renders during market bursts.
- **Memoized depth rows**: `DepthRow` component wrapped with `React.memo` and custom equality check. Only re-renders when its specific level changes (price, size, or depth), not when other rows update.
- **Memoized trade rows**: `TradeRow` component similarly memoized with per-trade equality. New trades arriving don't force re-render of existing rows.
- **Stable price keys**: Each depth level uses `level.price` as React key, ensuring consistent DOM identity across updates.
- **Bounded memory**: Verified that `buildLevels` never exceeds `LEVELS` (20) rows per side, and `deduplicateAndSortTrades` caps at `MAX_TRADES` (50).

## Performance characteristics

- **Delta reconciliation**: Pure functions `applyDelta` and `buildLevels` are replay-safe — applying deltas individually or batched converges to identical state.
- **Render frequency**: Under burst load, renders are capped at ~60fps (one per animation frame) regardless of WebSocket message rate.
- **Memory footprint**: Order book retains max 40 levels (20 bids + 20 asks), trades tape retains max 50 rows. Both are bounded and deterministic.
- **React reconciliation**: Memoized components skip re-render unless their specific data changes, reducing unnecessary DOM diffing.

## Test coverage

- **16 tests** for delta application, level building, convergence under batched vs unbatched deltas, and memory bounds.
- **12 tests** for trade deduplication, sorting, filtering, and bounded retention.
- All tests verify that rapid bursts of updates don't violate correctness or memory constraints.

## User-visible behavior

No user-visible functional changes — this is a pure performance optimization. The book and tape continue to show the same data with the same update frequency, but with reduced CPU usage and more consistent frame timing during high-message-rate periods.

## Technical notes

- `schedulePublish()` was already present in the code but only used during initial flush. Now it's used for all live WebSocket messages after snapshot.
- The `bookRef` (internal Map) is still mutated synchronously on every message — no deltas are dropped. Only the React state commit is coalesced.
- Custom `memo` equality functions check only the fields that affect rendering, not derived values or object identity.
- Price is the natural stable key for depth levels since it uniquely identifies a level and doesn't change within the level's lifetime.
