/**
 * apps/web/src/lib/graphql/use-indexer-invalidation.ts
 *
 * Hook to handle automatic query invalidation when network or account changes.
 * Ensures cached indexer data doesn't leak across contexts.
 */

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { indexerQueryKeys } from "./query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { debugLog } from "@/shared/lib/debug-log"

/**
 * Invalidate all indexer queries when network or account changes.
 * This ensures cached data doesn't leak across networks or accounts.
 *
 * @param account - Current connected account address
 */
export function useIndexerInvalidation(account: string | null) {
  const queryClient = useQueryClient()
  const prevAccountRef = useRef<string | null>(null)
  const prevNetworkRef = useRef<string>(INDEXER_CONFIG.network)

  useEffect(() => {
    const currentNetwork = INDEXER_CONFIG.network
    const prevAccount = prevAccountRef.current
    const prevNetwork = prevNetworkRef.current

    // Network changed - invalidate ALL indexer queries
    if (currentNetwork !== prevNetwork) {
      debugLog(`[Indexer] Network changed: ${prevNetwork} → ${currentNetwork}`)
      queryClient.invalidateQueries({
        queryKey: indexerQueryKeys.all(),
      })
      prevNetworkRef.current = currentNetwork
    }

    // Account changed - invalidate account-specific queries
    if (account !== prevAccount) {
      debugLog("[Indexer] Account changed; invalidating account queries")
      
      if (prevAccount) {
        // Invalidate queries for the old account
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.positions.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.orders.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.deposits.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.withdrawals.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.tradeHistory.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.fees.byAccount(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.referrals.traderReferral(prevAccount),
        })
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.referrals.affiliateTraders(prevAccount),
        })
      }

      prevAccountRef.current = account
    }
  }, [account, queryClient])
}
