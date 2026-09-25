/**
 * apps/web/src/features/trade/hooks/useAccountFeeClaims.ts
 *
 * Query hook for fetching account fee claims from SubQuery indexer.
 * Returns fee type, token, amount, and timestamp for all fee claims.
 */

import { useQuery } from "@tanstack/react-query"
import type { FeeClaim } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_FEE_CLAIMS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountFeeClaimsResult = {
  data: Array<FeeClaim>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all fee claims for a specific account from the SubQuery indexer.
 * Includes protocol fees, UI fees, and funding fees.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch fee claims for
 */
export function useAccountFeeClaims(account: string | null): UseAccountFeeClaimsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.fees.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_FEE_CLAIMS, { account }, { signal })
      return result.feeClaims.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!account,
    retry: 3,
    staleTime: 30_000,
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
