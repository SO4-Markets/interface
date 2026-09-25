/**
 * apps/web/src/features/trade/hooks/useAccountOrders.ts
 *
 * Query hook for fetching account orders from SubQuery indexer.
 * Returns order lifecycle states including created, frozen, executed, and cancelled.
 */

import { useQuery } from "@tanstack/react-query"
import type { Order } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_ACCOUNT_ORDERS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type UseAccountOrdersResult = {
  data: Array<Order>
  isLoading: boolean
  error: Error | null
  isDisabled: boolean
}

/**
 * Fetch all orders for a specific account from the SubQuery indexer.
 * When indexer is disabled, returns empty array with isDisabled=true.
 *
 * @param account - The account address to fetch orders for
 */
export function useAccountOrders(account: string | null): UseAccountOrdersResult {
  const { data, error, isLoading } = useQuery({
    queryKey: indexerQueryKeys.orders.byAccount(account ?? ""),
    queryFn: async ({ signal }) => {
      if (!INDEXER_CONFIG.enabled || !account) {
        return []
      }
      const result = await executeGraphQLQuery(GET_ACCOUNT_ORDERS, { account }, { signal })
      return result.orders.nodes
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
