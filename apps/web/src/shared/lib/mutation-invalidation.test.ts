import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import {
  MUTATION_REFRESH_MATRIX,
  invalidateMutationOutcome,
  mutationRefreshKeys,
} from "./mutation-invalidation"
import { indexerQueryKeys, queryKeys } from "./query-keys"

const context = {
  account: "GACCOUNT",
  network: "testnet",
  marketAddress: "CMARKET",
}

describe("mutation refresh matrix", () => {
  it("defines every required authoritative action", () => {
    expect(Object.keys(MUTATION_REFRESH_MATRIX).sort()).toEqual([
      "cancel",
      "claim",
      "close",
      "collateral",
      "create",
      "fill",
      "transfer",
    ])
  })

  it("keeps create confirmation scoped to order acceptance", () => {
    const keys = mutationRefreshKeys("create", context)
    expect(keys).toContainEqual(
      queryKeys.wallet.tokenBalances(context.account, context.network),
    )
    expect(keys).toContainEqual(
      queryKeys.trade.orders(context.network, context.account),
    )
    expect(keys).toContainEqual(
      indexerQueryKeys.orders.historyAll(context.account, context.network),
    )
    expect(keys).not.toContainEqual(
      queryKeys.trade.positions(context.network, context.account),
    )
  })

  it("refreshes fill/close positions, history, and market totals", () => {
    for (const action of ["fill", "close"] as const) {
      const keys = mutationRefreshKeys(action, context)
      expect(keys).toContainEqual(
        queryKeys.trade.positions(context.network, context.account),
      )
      expect(keys).toContainEqual(
        indexerQueryKeys.tradeHistory.pagesAll(
          context.account,
          context.network,
        ),
      )
      expect(keys).toContainEqual(
        queryKeys.trade.openInterest(
          context.marketAddress,
          context.network,
        ),
      )
    }
  })

  it("keeps collateral, claim, and transfer narrowly scoped", () => {
    const collateral = mutationRefreshKeys("collateral", context)
    const claim = mutationRefreshKeys("claim", context)
    const transfer = mutationRefreshKeys("transfer", context)

    expect(collateral).toContainEqual(
      queryKeys.trade.positions(context.network, context.account),
    )
    expect(collateral).not.toContainEqual(
      queryKeys.trade.orders(context.network, context.account),
    )
    expect(claim).toContainEqual(
      indexerQueryKeys.fees.byAccount(context.account, context.network),
    )
    expect(transfer).toEqual([
      queryKeys.wallet.tokenBalances(context.account, context.network),
    ])
  })

  it("marks inactive affected queries stale without touching unrelated families", async () => {
    const client = new QueryClient()
    const affected = queryKeys.trade.orders(context.network, context.account)
    const unrelated = queryKeys.trade.orders(context.network, "GOTHER")
    client.setQueryData(affected, ["affected"])
    client.setQueryData(unrelated, ["unrelated"])

    await invalidateMutationOutcome(client, "cancel", context)

    expect(client.getQueryState(affected)?.isInvalidated).toBe(true)
    expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false)
  })

  it("refetches active affected queries", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const affected = queryKeys.trade.orders(context.network, context.account)
    let requests = 0
    const observer = new QueryObserver(client, {
      queryKey: affected,
      queryFn: async () => ++requests,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => {
      expect(requests).toBe(1)
      expect(client.getQueryState(affected)?.fetchStatus).toBe("idle")
    })
    await invalidateMutationOutcome(client, "cancel", context)
    await vi.waitFor(() => expect(requests).toBe(2))

    unsubscribe()
    client.clear()
  })

  it("reports refresh failures without rejecting confirmed transaction truth", async () => {
    const client = new QueryClient()
    vi.spyOn(client, "invalidateQueries").mockRejectedValueOnce(
      new Error("indexer unavailable"),
    )

    const report = await invalidateMutationOutcome(
      client,
      "transfer",
      context,
    )

    expect(report.requested).toBe(1)
    expect(report.failed).toEqual([
      queryKeys.wallet.tokenBalances(context.account, context.network),
    ])
  })
})
