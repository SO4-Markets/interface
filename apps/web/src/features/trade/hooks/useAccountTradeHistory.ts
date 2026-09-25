/**
 * apps/web/src/features/trade/hooks/useAccountTradeHistory.ts
 *
 * Query hook for fetching account trade history from SubQuery indexer.
 * Returns position changes with execution price, PnL, and fees sorted by timestamp descending.
 */

import { useQuery } from "@tanstack/react-query"
import type { PositionChange } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_POSITION_CHANGES } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountTradeHistoryResult = {
  data: Array<PositionChange>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Stable empty array so consumers can memoize on `data` without a new array
 * identity being created on every render while the query has no data yet.
 */
const NO_HISTORY: Array<PositionChange> = []

/**
 * Fetch trade history (position changes) for a specific account from the SubQuery indexer.
 * Results are sorted by timestamp in descending order (most recent first).
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch trade history for
 */
export function useAccountTradeHistory(account: string | null): UseAccountTradeHistoryResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.tradeHistory.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_POSITION_CHANGES, { account }, { signal })
      return result.positionChanges.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!account,
    retry: 3,
    staleTime: 30_000,
  })

  if (!INDEXER_CONFIG.enabled) {
    return {
      data: NO_HISTORY,
      error: null,
      isLoading: false,
      isDisabled: true,
    }
  }

  return {
    data: data ?? NO_HISTORY,
    error: error,
    isLoading,
    isDisabled: false,
  }
}
