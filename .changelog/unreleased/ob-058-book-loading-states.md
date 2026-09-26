---
pr: TBD
area: order-book-ui
breaking: false
---

# Show truthful book loading, stale, and reconnecting states

**OB-058**: Connect source-health state to the order book and trades panels. The UI now shows distinct behavior for first load, empty venue, disconnected feed, rate limit, revision gap, and recovery states. Stale data is visibly marked with age indicators, and a semi-transparent overlay appears during reconnection without replacing the workspace with a loader.

## Changes

- **New source health system**: Introduced `useSourceHealth` hook that derives comprehensive connection state (initial-load, empty-venue, connected, stale, reconnecting, rate-limited, revision-gap, error) from connection status, data recency, and reconnect attempts.
- **Health tracking in feeds**: Updated `useOrderBook` and `useRecentTrades` to track last data timestamp, reconnect attempts, and derive source health on every state change.
- **Visual health indicators**: Added `SourceHealthBadge` component that displays status with color-coded dots, labels, and staleness duration when applicable.
- **Stale data overlays**: When connection is lost, the last known depth ladder and trades tape remain visible with a semi-transparent overlay indicating the stale state and recovery progress.
- **Order book tab enabled**: The "Order Book" tab in `OrderBookPanel` now shows the `DepthLadder` component (reference Binance data) instead of a placeholder message.
- **Preserved geometry**: Loading, stale, and reconnecting states maintain panel dimensions and do not trigger layout shifts.

## User-visible behavior

- **Initial load**: Shows "Connecting…" badge with amber pulsing indicator while fetching snapshot.
- **Live connected**: Shows "Live" badge with green pulsing indicator when receiving real-time updates.
- **Stale**: When disconnected, shows last known data with "Stale" badge and duration (e.g., "1m ago") plus overlay message.
- **Reconnecting**: During reconnect attempts, shows "Reconnecting (attempt N)…" badge with overlay.
- **Rate limited**: After 3+ rapid reconnect attempts, shows "Rate Limited" badge to indicate backoff.
- **Revision gap**: When detecting sequence inconsistencies, shows "Resyncing…" badge.
- **Empty venue**: When connected but no depth available, shows "No Depth" badge.
- **Error**: Shows "Error" badge with red indicator for unrecoverable failures.

Actions that depend on executable depth remain disabled until `sourceHealth.isExecutable` returns true (only in fully connected state).

## Technical notes

- Source health derivation is pure and deterministic, suitable for unit testing state transitions.
- Reconnect attempt counter increments on each new connection cycle, resets on successful data publish.
- Staleness duration is calculated from `Date.now() - lastDataTime` when connection is lost.
- The system distinguishes between "connecting for first time" (no prior data) and "reconnecting" (has stale snapshot).
- Health badges show duration only for staleness > 5s to avoid visual noise during brief interruptions.
