import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { queryKeys } from "@/shared/lib/query-keys"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

/**
 * Prefetch market data and related queries on navigation intent.
 * Coordinates router loaders and query options to parallelize independent reads.
 */
export function usePrefetch() {
  const queryClient = useQueryClient()
  const account = useWalletStore((state) => state.address)

  const prefetchMarket = useCallback(
    async (marketId: string) => {
      // Prefetch in parallel to avoid waterfalls. The canonical keys keep
      // prefetch state isolated by active network and data class.
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.landing.market(marketId),
          staleTime: 30_000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.landing.orderBook(marketId),
          staleTime: 5_000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.landing.trades(marketId),
          staleTime: 2_000,
        }),
      ]).catch(() => {
        // Silently fail on constrained networks
      })
    },
    [queryClient],
  )

  const prefetchBeforeTrade = useCallback(
    async (marketId: string) => {
      await Promise.all([
        prefetchMarket(marketId),
        queryClient.prefetchQuery({
          queryKey: queryKeys.landing.account(account),
          staleTime: 60_000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.landing.positions(account),
          staleTime: 10_000,
        }),
      ]).catch(() => {
        // Constrained network fallback
      })
    },
    [account, queryClient, prefetchMarket],
  )

  return {
    prefetchMarket,
    prefetchBeforeTrade,
  }
}
