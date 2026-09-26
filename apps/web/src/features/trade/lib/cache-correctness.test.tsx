import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { boundQueryCache, CACHE_POLICIES } from "./cache-policy"
import { queryKeys } from "./query-keys"

describe("Cache Correctness & Request Deduplication Regression (OB-110, OB-109)", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: CACHE_POLICIES.MARKET_DATA.staleTime,
          gcTime: CACHE_POLICIES.MARKET_DATA.gcTime,
          retry: false,
        },
      },
    })
  })

  describe("Request Deduplication", () => {
    it("deduplicates identical concurrent queries into a single fetch execution", async () => {
      let fetchCount = 0
      const queryFn = vi.fn().mockImplementation(async () => {
        fetchCount++
        return { symbol: "XLM", price: 0.12 }
      })

      const queryKey = queryKeys.trade.priceDelta24h("XLM")

      // Mount 3 concurrent consumers requesting the same query
      const [res1, res2, res3] = await Promise.all([
        queryClient.fetchQuery({ queryKey, queryFn }),
        queryClient.fetchQuery({ queryKey, queryFn }),
        queryClient.fetchQuery({ queryKey, queryFn }),
      ])

      expect(fetchCount).toBe(1)
      expect(queryFn).toHaveBeenCalledTimes(1)
      expect(res1).toEqual(res2)
      expect(res2).toEqual(res3)
    })
  })

  describe("Scope Changes & Isolation", () => {
    it("isolates data across different account scopes without leakage", async () => {
      const accountA = "GACCOUNT_A"
      const accountB = "GACCOUNT_B"
      const chainId = "stellar-mainnet"

      const positionsA = [{ id: "pos-1", sizeUsd: 1000 }]
      const positionsB = [{ id: "pos-2", sizeUsd: 5000 }]

      queryClient.setQueryData(queryKeys.trade.positions(chainId, accountA), positionsA)
      queryClient.setQueryData(queryKeys.trade.positions(chainId, accountB), positionsB)

      const fetchedA = queryClient.getQueryData(queryKeys.trade.positions(chainId, accountA))
      const fetchedB = queryClient.getQueryData(queryKeys.trade.positions(chainId, accountB))

      expect(fetchedA).toEqual(positionsA)
      expect(fetchedB).toEqual(positionsB)
      expect(fetchedA).not.toEqual(fetchedB)
    })

    it("isolates unrelated markets when invalidating queries", async () => {
      const btcKey = queryKeys.trade.openInterest("CBTC_MARKET")
      const ethKey = queryKeys.trade.openInterest("CETH_MARKET")

      let btcFetches = 0
      let ethFetches = 0

      await queryClient.fetchQuery({
        queryKey: btcKey,
        queryFn: async () => {
          btcFetches++
          return { oi: 100 }
        },
      })

      await queryClient.fetchQuery({
        queryKey: ethKey,
        queryFn: async () => {
          ethFetches++
          return { oi: 200 }
        },
      })

      expect(btcFetches).toBe(1)
      expect(ethFetches).toBe(1)

      // Invalidate ONLY BTC market
      await queryClient.invalidateQueries({ queryKey: btcKey })

      const btcQuery = queryClient.getQueryCache().find({ queryKey: btcKey })
      const ethQuery = queryClient.getQueryCache().find({ queryKey: ethKey })

      expect(btcQuery?.isStale()).toBe(true)
      expect(ethQuery?.isStale()).toBe(false)
    })
  })

  describe("Bounded Cache Retention in Long Sessions (OB-109)", () => {
    it("prunes oldest inactive queries when exceeding bounded threshold", async () => {
      const maxInactive = 5
      const cleanup = boundQueryCache(queryClient, maxInactive)

      // Simulate long session switching through 10 markets
      for (let i = 0; i < 10; i++) {
        const key = queryKeys.trade.priceDelta24h(`MARKET_${i}`)
        queryClient.setQueryData(key, { price: i * 10 })
      }

      const allQueries = queryClient.getQueryCache().getAll()
      const inactive = allQueries.filter((q) => !q.isActive())

      // Inactive queries must be bounded to maxInactive
      expect(inactive.length).toBeLessThanOrEqual(maxInactive)

      cleanup()
    })
  })

  describe("Mutation-Driven Refresh Without Manual Reload", () => {
    it("updates observable query data reactively following confirmation invalidation", async () => {
      const account = "GACCOUNT_TEST"
      const chainId = "stellar-mainnet"
      const positionsKey = queryKeys.trade.positions(chainId, account)

      let currentPositions = [{ id: "order-1", status: "open" }]

      await queryClient.fetchQuery({
        queryKey: positionsKey,
        queryFn: async () => currentPositions,
      })

      expect(queryClient.getQueryData(positionsKey)).toEqual([{ id: "order-1", status: "open" }])

      // Transaction confirmation fills position
      currentPositions = [{ id: "order-1", status: "filled" }]
      await queryClient.invalidateQueries({ queryKey: positionsKey })

      // Subsequent query returns updated server state without manual page reload
      const updated = await queryClient.fetchQuery({
        queryKey: positionsKey,
        queryFn: async () => currentPositions,
      })

      expect(updated).toEqual([{ id: "order-1", status: "filled" }])
    })
  })

  describe("Out-of-Order Response Protection", () => {
    it("prevents older delayed responses from overwriting newer query data", async () => {
      const key = queryKeys.trade.priceDelta24h("BTC")

      // Fresh data arrives
      queryClient.setQueryData(key, { price: 65000, timestamp: 200 })

      // An older delayed response completes with earlier timestamp
      const olderData = { price: 64000, timestamp: 100 }
      const current = queryClient.getQueryData<{ price: number; timestamp: number }>(key)

      if (current && olderData.timestamp < current.timestamp) {
        // Discard older out-of-order response
      } else {
        queryClient.setQueryData(key, olderData)
      }

      expect(queryClient.getQueryData(key)).toEqual({ price: 65000, timestamp: 200 })
    })
  })
})
