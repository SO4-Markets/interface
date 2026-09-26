/**
 * apps/web/src/features/earn/hooks/useAccountDeposits.ts
 *
 * Query hook for fetching account deposits from SubQuery indexer.
 * Returns deposit status (created, executed, cancelled) with amounts and timestamps.
 */

import { useQuery } from "@tanstack/react-query"
import type { Deposit } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_DEPOSITS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountDepositsResult = {
  data: Array<Deposit>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all deposits for a specific account from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch deposits for
 */
export function useAccountDeposits(account: string | null): UseAccountDepositsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.deposits.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_DEPOSITS, { account }, { signal })
      return result.deposits.nodes
    },
    enabled: INDEXER_CONFIG.enabled && !!account,
    retry: 3,
    staleTime: 10_000, // 10 seconds
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
