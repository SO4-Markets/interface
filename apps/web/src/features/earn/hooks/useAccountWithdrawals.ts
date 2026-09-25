/**
 * apps/web/src/features/earn/hooks/useAccountWithdrawals.ts
 *
 * Query hook for fetching account withdrawals from SubQuery indexer.
 * Returns withdrawal status (created, executed, cancelled) with amounts and timestamps.
 */

import { useQuery } from "@tanstack/react-query"
import type { Withdrawal } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_WITHDRAWALS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountWithdrawalsResult = {
  data: Array<Withdrawal>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all withdrawals for a specific account from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch withdrawals for
 */
export function useAccountWithdrawals(account: string | null): UseAccountWithdrawalsResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.withdrawals.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_WITHDRAWALS, { account }, { signal })
      return result.withdrawals.nodes
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
