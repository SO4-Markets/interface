/**
 * apps/web/src/features/trade/hooks/useAccountPositions.ts
 *
 * Query hook for fetching account positions from SubQuery indexer.
 * Returns position status, size, collateral, and entry price from indexed data.
 */

import { useQuery } from "@tanstack/react-query"
import type { Position } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_POSITIONS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountPositionsResult = {
  data: Array<Position>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all positions for a specific account from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch positions for
 */
export function useAccountPositions(account: string | null): UseAccountPositionsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.positions.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_POSITIONS, { account }, { signal })
      return result.positions.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!account,
    retry: 3,
    staleTime: 10_000,
  })

  if (!INDEXER_CONFIG.enabled) {
    return {
      data: [],
      error: null,
      isLoading: false,
      isDisabled: true,
    }
  }

  return {
    data: data ?? [],
    error: error,
    isLoading,
    isDisabled: false,
  }
}
