import type { QueryClient } from "@tanstack/react-query"

/**
 * Cache retention and freshness policies by data class.
 *
 * Distinguishes staleTime (freshness) from gcTime (retention).
 * Live financial data (positions, balances, orders) is kept fresh and never
 * persisted authoritatively in local storage.
 */
export const CACHE_POLICIES = {
  MARKET_DATA: {
    staleTime: 30_000,
    gcTime: 5 * 60_000, // 5 min
  },
  REALTIME_TAPE: {
    staleTime: 2_000,
    gcTime: 60_000, // 1 min
  },
  ACCOUNT_FINANCIAL: {
    staleTime: 5_000,
    gcTime: 2 * 60_000, // 2 min
  },
  HISTORY: {
    staleTime: 30_000,
    gcTime: 3 * 60_000, // 3 min
  },
} as const

export const DEFAULT_MAX_INACTIVE_QUERIES = 50

/**
 * Enforces bounded entity growth in the TanStack Query cache.
 *
 * In long sessions where a user repeatedly switches markets and accounts,
 * inactive queries are pruned so that cache entity count remains strictly bounded.
 */
export function boundQueryCache(
  queryClient: QueryClient,
  maxInactive = DEFAULT_MAX_INACTIVE_QUERIES,
): () => void {
  const queryCache = queryClient.getQueryCache()

  const unsubscribe = queryCache.subscribe(() => {
    const allQueries = queryCache.getAll()
    const inactiveQueries = allQueries.filter((q) => !q.isActive())

    if (inactiveQueries.length > maxInactive) {
      // Sort oldest first (by last updated or accessed)
      const sorted = [...inactiveQueries].sort(
        (a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt,
      )
      const excessCount = inactiveQueries.length - maxInactive
      const toRemove = sorted.slice(0, excessCount)

      for (const query of toRemove) {
        queryClient.removeQueries({ queryKey: query.queryKey, exact: true })
      }
    }
  })

  return unsubscribe
}
