/**
 * apps/web/src/features/trade/lib/position-refresh.ts
 *
 * Action-specific refresh map for position mutations (OB-086).
 *
 * A close and a collateral change invalidate different things. Invalidating
 * everything on every action hides bugs and hammers the indexer; invalidating
 * the wrong thing leaves the row showing pre-transaction numbers. Each action
 * declares exactly which data classes it can have changed.
 *
 * Two documented TanStack Query behaviours are relied on here:
 *   - `invalidateQueries` marks a query stale and refetches it *if it is
 *     active*. For an inactive query it only marks it stale, and the next mount
 *     refetches. That is why an action taken while a panel is unmounted still
 *     shows fresh data when the panel reopens — and also why invalidating an
 *     active query proves nothing about the indexer catching up.
 *   - Prefix matching is used deliberately for the paginated history keys, so
 *     every filter variant of the view is invalidated without wiping the entire
 *     indexer namespace.
 */

import { activeQueryNetwork, queryKeys } from "./query-keys"
import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"

const CHAIN_ID = activeQueryNetwork()

export type PositionActionKind = "close" | "add-collateral" | "remove-collateral"

export type PositionRefreshTarget =
  /** Fresh, price-independent contract state. */
  | "positionsFresh"
  /** Full priced position rows (legacy bundle). */
  | "positions"
  /** Open orders, so a close that produced a resting order shows up. */
  | "orders"
  /** Wallet balances change on collateral deposit/withdrawal. */
  | "tokenBalances"
  /** Indexed position rows (contract-only deployments have no equivalent). */
  | "indexerPositions"
  /** Indexed order records. */
  | "indexerOrders"
  /** Executed fills — a close produces one. */
  | "indexerTradeHistory"

export const POSITION_REFRESH_MAP: Record<
  PositionActionKind,
  ReadonlyArray<PositionRefreshTarget>
> = {
  close: [
    "positionsFresh",
    "positions",
    "orders",
    "tokenBalances",
    "indexerPositions",
    "indexerOrders",
    "indexerTradeHistory",
  ],
  "add-collateral": [
    "positionsFresh",
    "positions",
    "tokenBalances",
    "indexerPositions",
  ],
  "remove-collateral": [
    "positionsFresh",
    "positions",
    "tokenBalances",
    "indexerPositions",
  ],
}

/** Resolve every refresh target for an account to concrete TanStack keys. */
export function positionRefreshKeys(
  account: string,
): Record<PositionRefreshTarget, ReadonlyArray<QueryKey>> {
  return {
    positionsFresh: [queryKeys.trade.positionsFresh(CHAIN_ID, account)],
    positions: [queryKeys.trade.positions(CHAIN_ID, account)],
    orders: [queryKeys.trade.orders(CHAIN_ID, account)],
    tokenBalances: [queryKeys.wallet.tokenBalances(account, CHAIN_ID)],
    indexerPositions: [indexerQueryKeys.positions.byAccount(account)],
    indexerOrders: [
      indexerQueryKeys.orders.byAccount(account),
      indexerQueryKeys.orders.historyAll(account),
    ],
    indexerTradeHistory: [
      indexerQueryKeys.tradeHistory.byAccount(account),
      indexerQueryKeys.tradeHistory.pagesAll(account),
    ],
  }
}

/**
 * Invalidate exactly the data classes an action can have changed.
 *
 * Only call this once the changed state is authoritative (transaction
 * confirmed). Never call it from the wallet-approval or submission step — a
 * confirmation does not mean a resting order has filled.
 */
export async function invalidatePositionActionTargets(
  queryClient: QueryClient,
  account: string,
  kind: PositionActionKind,
): Promise<void> {
  const keys = positionRefreshKeys(account)
  const targets = POSITION_REFRESH_MAP[kind]

  await Promise.all(
    targets.flatMap((target) =>
      keys[target].map((queryKey) =>
        queryClient.invalidateQueries({
          queryKey,
          // Active views refetch now; inactive views are only marked stale and
          // refetch when they next mount.
          refetchType: "active",
        }),
      ),
    ),
  )
}
