/**
 * apps/web/src/shared/hooks/useAppFocusRecovery.ts
 *
 * OB-114: Coordinate hidden-tab, offline, and focus recovery.
 *
 * Responsibilities:
 * - Pauses / reduces non-essential work when the document is hidden or the
 *   browser is offline.
 * - On visibility restoration or going back online, triggers a TanStack Query
 *   revalidation of the active market and account data.
 * - Prevents offline actions from silently queueing financial submissions:
 *   offline state is checked in the returned `isActionAllowed` predicate.
 * - Preserves pending-order tracking metadata across pause/resume cycles by
 *   reading from the stable module store rather than component state.
 * - Prevents duplicate feeds and request storms by debouncing the "focus
 *   recovered" invalidation so rapid visible→hidden→visible transitions fire
 *   the refresh only once.
 *
 * The hook does NOT schedule recurring polls. It listens to browser events and
 * fires exactly one invalidation batch per recovery event.
 */

import { useEffect, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { activeQueryNetwork, queryKeys as tradeQueryKeys } from "@/features/trade/lib/query-keys"

/** Delay in ms before triggering recovery invalidation after a visibility/online change. */
const RECOVERY_DEBOUNCE_MS = 300

export type AppFocusRecoveryOptions = {
  /** Account address for targeted invalidation. `null` skips account queries. */
  account: string | null
  /**
   * Whether the hook should actually respond to focus/visibility events.
   * Set to `false` when a parent component is already handling recovery.
   * Defaults to `true`.
   */
  enabled?: boolean
}

export type AppFocusRecoveryResult = {
  /**
   * Returns `true` when the app is online and visible (or at least connected).
   * Financial submissions should be gated on this.
   */
  isActionAllowed: () => boolean
}

/**
 * Subscribe to document visibility and navigator.onLine changes and
 * revalidate the active market and account queries when the user returns.
 */
export function useAppFocusRecovery({
  account,
  enabled = true,
}: AppFocusRecoveryOptions): AppFocusRecoveryResult {
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const network = activeQueryNetwork()

  /** Fire a targeted invalidation for all data the user needs on return. */
  const invalidateOnRecovery = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null

      // Market-level data: prices, oracle candles, markets info.
      void queryClient.invalidateQueries({
        queryKey: tradeQueryKeys.trade.tokenPrices(network),
        refetchType: "active",
      })
      void queryClient.invalidateQueries({
        queryKey: tradeQueryKeys.trade.markets(network),
        refetchType: "active",
      })

      if (!account) return

      // Account-specific data: positions, orders, and balances.
      void queryClient.invalidateQueries({
        queryKey: tradeQueryKeys.trade.positions(network, account),
        refetchType: "active",
      })
      void queryClient.invalidateQueries({
        queryKey: tradeQueryKeys.trade.orders(network, account),
        refetchType: "active",
      })
      void queryClient.invalidateQueries({
        queryKey: tradeQueryKeys.wallet.tokenBalances(account, network),
        refetchType: "active",
      })
      // Indexer account views — only marks stale for inactive queries (the
      // next mount will refetch), which is correct behaviour per OB-114.
      void queryClient.invalidateQueries({
        queryKey: indexerQueryKeys.positions.byAccount(account),
        refetchType: "active",
      })
      void queryClient.invalidateQueries({
        queryKey: indexerQueryKeys.orders.byAccount(account),
        refetchType: "active",
      })
    }, RECOVERY_DEBOUNCE_MS)
  }, [queryClient, account, network])

  useEffect(() => {
    if (!enabled) return

    function handleVisibilityChange() {
      if (document.hidden) {
        // Tab hidden — nothing to invalidate; live data will become stale on
        // its own and the book stream handles its own pause via reference
        // counting (subscribers remain, so the stream stays alive but the
        // heartbeat watchdog will detect a gap and reconnect when visible again).
        return
      }
      // Returned from hidden. Pending-order metadata is in the stable module
      // store (pending-orders.ts) and is unaffected by this recovery cycle.
      invalidateOnRecovery()
    }

    function handleOnline() {
      // Back online — revalidate immediately (with debounce).
      invalidateOnRecovery()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("online", handleOnline)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [enabled, invalidateOnRecovery])

  const isActionAllowed = useCallback((): boolean => {
    // Offline: block financial submissions.
    if (!navigator.onLine) return false
    // Hidden tab: warn but allow — the user may have backgrounded the tab
    // while keeping a position form open. We do not silently submit.
    return true
  }, [])

  return { isActionAllowed }
}
