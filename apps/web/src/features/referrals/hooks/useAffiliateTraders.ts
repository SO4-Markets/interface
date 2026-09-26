/**
 * apps/web/src/features/referrals/hooks/useAffiliateTraders.ts
 *
 * Query hook for fetching traders referred by an affiliate from SubQuery indexer.
 * Returns list of traders assigned to the affiliate's referral codes.
 */

import { useQuery } from "@tanstack/react-query"
import type { TraderReferral } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_AFFILIATE_TRADERS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAffiliateTradersResult = {
  data: Array<TraderReferral>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all traders referred by a specific affiliate from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param owner - The affiliate address (referrer) to fetch traders for
 */
export function useAffiliateTraders(owner: string | null): UseAffiliateTradersResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.referrals.affiliateTraders(owner ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !owner) {
        return []
      }
      const result = await executeGraphQLQuery(GET_AFFILIATE_TRADERS, { owner }, { signal })
      return result.traderReferrals.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!owner,
    retry: 3,
    staleTime: 60_000, // 60 seconds
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
