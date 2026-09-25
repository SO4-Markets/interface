import type { QueryClient, QueryKey } from "@tanstack/react-query"
import {
  indexerQueryKeys,
  normalizeQueryNetwork,
  queryKeys,
} from "@/shared/lib/query-keys"

export type AuthoritativeMutationAction =
  | "create"
  | "cancel"
  | "fill"
  | "close"
  | "collateral"
  | "claim"
  | "transfer"

export type MutationRefreshTarget =
  | "balances"
  | "orders"
  | "positions"
  | "orderHistory"
  | "fillHistory"
  | "feeHistory"
  | "marketTotals"

export const MUTATION_REFRESH_MATRIX: Record<
  AuthoritativeMutationAction,
  ReadonlyArray<MutationRefreshTarget>
> = {
  create: ["balances", "orders", "orderHistory"],
  cancel: ["balances", "orders", "orderHistory"],
  fill: [
    "balances",
    "orders",
    "positions",
    "orderHistory",
    "fillHistory",
    "marketTotals",
  ],
  close: [
    "balances",
    "orders",
    "positions",
    "orderHistory",
    "fillHistory",
    "marketTotals",
  ],
  collateral: ["balances", "positions"],
  claim: ["balances", "feeHistory"],
  transfer: ["balances"],
}

export type MutationRefreshContext = {
  account: string
  network: string
  marketAddress?: string | null
}

function targetKeys(
  target: MutationRefreshTarget,
  context: MutationRefreshContext,
): ReadonlyArray<QueryKey> {
  const network = normalizeQueryNetwork(context.network)

  switch (target) {
    case "balances":
      return [queryKeys.wallet.tokenBalances(context.account, network)]
    case "orders":
      return [
        queryKeys.trade.orders(network, context.account),
        indexerQueryKeys.orders.byAccount(context.account, network),
      ]
    case "positions":
      return [
        queryKeys.trade.positions(network, context.account),
        queryKeys.trade.positionsFresh(network, context.account),
        indexerQueryKeys.positions.byAccount(context.account, network),
      ]
    case "orderHistory":
      return [indexerQueryKeys.orders.historyAll(context.account, network)]
    case "fillHistory":
      return [
        indexerQueryKeys.tradeHistory.byAccount(context.account, network),
        indexerQueryKeys.tradeHistory.pagesAll(context.account, network),
      ]
    case "feeHistory":
      return [indexerQueryKeys.fees.byAccount(context.account, network)]
    case "marketTotals":
      return [
        queryKeys.trade.marketsInfo(network),
        ...(context.marketAddress
          ? [queryKeys.trade.openInterest(context.marketAddress, network)]
          : []),
      ]
  }
}

export function mutationRefreshKeys(
  action: AuthoritativeMutationAction,
  context: MutationRefreshContext,
): ReadonlyArray<QueryKey> {
  const keys: Array<QueryKey> = []
  const seen = new Set<string>()

  for (const target of MUTATION_REFRESH_MATRIX[action]) {
    for (const key of targetKeys(target, context)) {
      const fingerprint = JSON.stringify(key)
      if (seen.has(fingerprint)) continue
      seen.add(fingerprint)
      keys.push(key)
    }
  }

  return keys
}

export type MutationRefreshReport = {
  requested: number
  failed: Array<QueryKey>
}

/**
 * Invalidate only the families affected by an authoritative mutation outcome.
 * Active observers refetch now; inactive observers remain stale until next use.
 * Refresh failures are reported instead of thrown so they cannot rewrite a
 * confirmed transaction as a failed transaction.
 */
export async function invalidateMutationOutcome(
  client: QueryClient,
  action: AuthoritativeMutationAction,
  context: MutationRefreshContext,
): Promise<MutationRefreshReport> {
  const keys = mutationRefreshKeys(action, context)
  const settled = await Promise.allSettled(
    keys.map((queryKey) =>
      client.invalidateQueries({
        queryKey,
        refetchType: "active",
      }),
    ),
  )

  return {
    requested: keys.length,
    failed: settled.flatMap((result, index) =>
      result.status === "rejected" ? [keys[index]] : [],
    ),
  }
}
