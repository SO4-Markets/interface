/**
 * OB-058: Source health tracking for order book and trades feeds.
 *
 * Tracks connection state, snapshot freshness, and recovery progress
 * to inform UI decisions about data reliability and action availability.
 */

export type SourceHealthStatus =
  | "initial-load"       // First connection attempt, no data yet
  | "empty-venue"        // Connected but no executable depth available
  | "connected"          // Live and receiving updates
  | "stale"              // Connection lost, showing last known data
  | "reconnecting"       // Attempting to restore connection
  | "rate-limited"       // Throttled by upstream, backing off
  | "revision-gap"       // Detected sequence gap, resyncing
  | "error"              // Unrecoverable error state

export type SourceHealth = {
  status: SourceHealthStatus
  lastUpdateTime: number | null      // ms timestamp of last data received
  staleDuration: number | null       // ms since last update (when stale)
  reconnectAttempt: number           // count of reconnect attempts
  isExecutable: boolean              // whether actions can be taken
  message: string                    // human-readable status description
}

type SourceHealthInput = {
  status: "connecting" | "connected" | "disconnected" | "error"
  hasData: boolean
  lastDataTime: number | null
}

/**
 * Derives comprehensive source health from connection status and data recency.
 */
export function deriveSourceHealth(
  input: SourceHealthInput,
  now: number,
  reconnectAttempt: number
): SourceHealth {
  const { status, hasData, lastDataTime } = input

  // Calculate staleness
  const staleDuration = lastDataTime && status !== "connected"
    ? now - lastDataTime
    : null

  // Initial load: connecting for the first time, no data yet
  if (status === "connecting" && !hasData) {
    return {
      status: "initial-load",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connecting to market data feed…",
    }
  }

  // Empty venue: connected but no depth data
  if (status === "connected" && !hasData && lastDataTime === null) {
    return {
      status: "empty-venue",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connected — no executable depth available",
    }
  }

  // Connected: live updates flowing
  if (status === "connected" && hasData) {
    return {
      status: "connected",
      lastUpdateTime: lastDataTime,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: true,
      message: "Live market data",
    }
  }

  // Rate limited: detected throttling (heuristic: rapid disconnects)
  if (reconnectAttempt >= 3 && reconnectAttempt <= 5) {
    return {
      status: "rate-limited",
      lastUpdateTime: lastDataTime,
      staleDuration,
      reconnectAttempt,
      isExecutable: false,
      message: "Rate limited — backing off…",
    }
  }

  // Revision gap: connected but sequence inconsistency detected
  // (This would require sequence tracking in the feed hooks; placeholder logic)
  // For now, we'll infer this from repeated connection attempts with data
  if (status === "connecting" && hasData && reconnectAttempt > 0 && reconnectAttempt < 3) {
    return {
      status: "revision-gap",
      lastUpdateTime: lastDataTime,
      staleDuration,
      reconnectAttempt,
      isExecutable: false,
      message: "Resyncing — detected data gap",
    }
  }

  // Reconnecting: lost connection, attempting restore (only during connecting)
  if (status === "connecting" && hasData) {
    return {
      status: "reconnecting",
      lastUpdateTime: lastDataTime,
      staleDuration,
      reconnectAttempt,
      isExecutable: false,
      message: reconnectAttempt > 0
        ? `Reconnecting (attempt ${reconnectAttempt})…`
        : "Reconnecting to market data…",
    }
  }

  // Stale: connection lost, showing last snapshot
  if (status === "disconnected" && hasData) {
    return {
      status: "stale",
      lastUpdateTime: lastDataTime,
      staleDuration,
      reconnectAttempt,
      isExecutable: false,
      message: staleDuration && staleDuration > 60_000
        ? `Data stale (${Math.floor(staleDuration / 1000)}s ago)`
        : "Connection lost — showing last known data",
    }
  }

  // Error: unrecoverable failure
  if (status === "error") {
    return {
      status: "error",
      lastUpdateTime: lastDataTime,
      staleDuration,
      reconnectAttempt,
      isExecutable: false,
      message: "Feed error — unable to connect",
    }
  }

  // Fallback: disconnected with no data
  return {
    status: "error",
    lastUpdateTime: null,
    staleDuration: null,
    reconnectAttempt,
    isExecutable: false,
    message: "No market data available",
  }
}

/**
 * Formats staleness duration for display.
 */
export function formatStaleDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
