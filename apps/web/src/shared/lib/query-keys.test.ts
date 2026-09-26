import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import {
  activeQueryNetwork,
  indexerQueryKeys,
  normalizeQueryNetwork,
  queryKeys,
} from "./query-keys"
import { invalidatePositionActionTargets } from "@/features/trade/lib/position-refresh"

describe("canonical query keys", () => {
  it("isolates identical account and market data across networks", () => {
    const account = "GACCOUNT"
    const market = "CBTC"

    expect(queryKeys.trade.positions("testnet", account)).not.toEqual(
      queryKeys.trade.positions("mainnet", account),
    )
    expect(queryKeys.trade.feeConfig("testnet", market)).not.toEqual(
      queryKeys.trade.feeConfig("mainnet", market),
    )
    expect(indexerQueryKeys.positions.byAccount(account, "testnet")).not.toEqual(
      indexerQueryKeys.positions.byAccount(account, "mainnet"),
    )
  })

  it("keeps RPC and indexer representations intentionally separate", () => {
    const account = "GACCOUNT"
    const rpc = queryKeys.trade.positions("testnet", account)
    const indexed = indexerQueryKeys.positions.byAccount(account, "testnet")

    expect(rpc).not.toEqual(indexed)
    expect(rpc).toContain("rpc")
    expect(indexed).toContain("indexer")
  })

  it("keeps account scope isolated and prefix matching intentional", () => {
    const a = indexerQueryKeys.orders.history("GA", {
      marketKey: null,
      stage: "all",
      range: "7d",
    }, "testnet")
    const b = indexerQueryKeys.orders.history("GB", {
      marketKey: null,
      stage: "all",
      range: "7d",
    }, "testnet")
    const prefix = indexerQueryKeys.orders.historyAll("GA", "testnet")

    expect(a.slice(0, prefix.length)).toEqual(prefix)
    expect(b.slice(0, prefix.length)).not.toEqual(prefix)
  })

  it("does not alias absent and concrete optional filters", () => {
    const absent = indexerQueryKeys.tradeHistory.pages("GA", {
      marketKey: null,
      side: null,
      range: null,
    }, "testnet")
    const concrete = indexerQueryKeys.tradeHistory.pages("GA", {
      marketKey: "",
      side: "all",
      range: "all",
    }, "testnet")

    expect(absent).not.toEqual(concrete)
    expect(absent.at(-1)).toBeNull()
  })

  it("normalizes legacy network spellings without conflating networks", () => {
    expect(normalizeQueryNetwork("stellar-mainnet")).toBe("mainnet")
    expect(normalizeQueryNetwork("public")).toBe("mainnet")
    expect(normalizeQueryNetwork("stellar-testnet")).toBe("testnet")
    expect(normalizeQueryNetwork("mainnet")).not.toBe(
      normalizeQueryNetwork("testnet"),
    )
  })
})

describe("canonical producer/invalidation integration", () => {
  it("invalidates the affected account families without touching another account or network", async () => {
    const client = new QueryClient()
    const account = "GACCOUNT"
    const other = "GOTHER"

    const activeNetwork = activeQueryNetwork()
    const otherNetworkName = activeNetwork === "mainnet" ? "testnet" : "mainnet"
    const activePosition = queryKeys.trade.positions(activeNetwork, account)
    const otherAccount = queryKeys.trade.positions(activeNetwork, other)
    const otherNetwork = queryKeys.trade.positions(otherNetworkName, account)

    client.setQueryData(activePosition, [{ id: "mine" }])
    client.setQueryData(otherAccount, [{ id: "other" }])
    client.setQueryData(otherNetwork, [{ id: "other-network" }])

    // positionRefresh uses the active app network, so only that
    // network/account family should become stale.
    await invalidatePositionActionTargets(client, account, "close")

    expect(client.getQueryState(activePosition)?.isInvalidated).toBe(true)
    expect(client.getQueryState(otherAccount)?.isInvalidated).toBe(false)
    expect(client.getQueryState(otherNetwork)?.isInvalidated).toBe(false)
  })
})
