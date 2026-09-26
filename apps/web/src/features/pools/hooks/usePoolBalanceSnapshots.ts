/**
 * apps/web/src/features/pools/hooks/usePoolBalanceSnapshots.ts
 *
 * Query hook for fetching pool balance snapshots from SubQuery indexer.
 * Returns pool amounts, reserved amounts, and open interest for a specific market.
 */

import { useQuery } from "@tanstack/react-query"
import type { PoolBalanceSnapshot } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_POOL_BALANCE_SNAPSHOTS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UsePoolBalanceSnapshotsResult = {
  data: Array<PoolBalanceSnapshot>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch pool balance snapshots for a specific market from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param marketKey - The market key to fetch pool snapshots for
 */
export function usePoolBalanceSnapshots(marketKey: string): UsePoolBalanceSnapshotsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.pools.snapshots(marketKey),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled) {
        return []
      }
      const result = await executeGraphQLQuery(GET_POOL_BALANCE_SNAPSHOTS, { marketKey }, { signal })
      return result.poolBalanceSnapshots.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!marketKey,
    retry: 3,
    staleTime: 30_000, // 30 seconds
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
