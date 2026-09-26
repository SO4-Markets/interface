/**
 * apps/web/src/features/pools/hooks/useMarkets.ts
 *
 * Query hook for fetching market definitions from SubQuery indexer.
 * Returns dynamically indexed markets with graceful fallback when indexer is disabled.
 */

import { useQuery } from "@tanstack/react-query"
import type { Market } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_MARKETS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { queryPolicy } from "@/shared/lib/query-policies"

export type UseMarketsResult = {
  data: Array<Market>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all markets from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 */
export function useMarkets(): UseMarketsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.markets.all(),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled) {
        return []
      }
      const result = await executeGraphQLQuery(GET_MARKETS, {}, { signal })
      return result.markets.nodes
    },
    enabled: INDEXER_CONFIG.enabled,
    ...queryPolicy("metadata"), // 30 seconds
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
