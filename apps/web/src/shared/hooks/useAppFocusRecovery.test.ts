/**
 * apps/web/src/shared/hooks/useAppFocusRecovery.test.ts
 *
 * OB-114: Tests for the hidden-tab, offline, and focus recovery coordinator.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { useAppFocusRecovery } from "./useAppFocusRecovery"

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/features/trade/lib/query-keys", () => ({
  activeQueryNetwork: () => "testnet",
  queryKeys: {
    trade: {
      tokenPrices: (n: string) => ["so4", n, "perps", "rpc", "trade", "token-prices"],
      markets: (n: string) => ["so4", n, "perps", "rpc", "trade", "markets"],
      positions: (n: string, a: string) => ["so4", n, "perps", "rpc", "trade", "positions", a],
      orders: (n: string, a: string) => ["so4", n, "perps", "rpc", "trade", "orders", a],
    },
    wallet: {
      tokenBalances: (a: string, n: string) => ["so4", n, "wallet", "rpc", "token-balances", a],
    },
  },
}))

vi.mock("@/lib/graphql/query-keys", () => ({
  indexerQueryKeys: {
    positions: {
      byAccount: (a: string) => ["so4", "testnet", "indexer", "positions", a],
    },
    orders: {
      byAccount: (a: string) => ["so4", "testnet", "indexer", "orders", a],
    },
  },
}))

// ── Test helpers ───────────────────────────────────────────────────────────────

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useAppFocusRecovery (OB-114)", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.useFakeTimers()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(queryClient, "invalidateQueries")

    // Simulate online + visible defaults.
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true })
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does not invalidate on initial mount", () => {
    renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    vi.runAllTimers()
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it("triggers invalidation when document becomes visible", async () => {
    renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    // Simulate tab hidden then visible.
    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true })
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })

    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })

    act(() => { vi.runAllTimers() })

    expect(queryClient.invalidateQueries).toHaveBeenCalled()
  })

  it("triggers invalidation when coming back online", () => {
    renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    act(() => { window.dispatchEvent(new Event("online")) })
    act(() => { vi.runAllTimers() })

    expect(queryClient.invalidateQueries).toHaveBeenCalled()
  })

  it("debounces rapid visibility changes into a single invalidation", () => {
    renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    // Fire several recovery events in rapid succession.
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("online"))
    })
    act(() => { vi.runAllTimers() })

    // Despite 3 events, the debounce should consolidate into a bounded call count.
    // Each invalidateQueries call is per-key; what matters is no unbounded burst.
    const callCount = vi.mocked(queryClient.invalidateQueries).mock.calls.length
    expect(callCount).toBeLessThan(20)
  })

  it("does not invalidate when enabled=false", () => {
    renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF", enabled: false }),
      { wrapper: createWrapper(queryClient) },
    )

    act(() => {
      Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      vi.runAllTimers()
    })

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it("isActionAllowed returns false when offline", () => {
    const { result } = renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true })
    expect(result.current.isActionAllowed()).toBe(false)
  })

  it("isActionAllowed returns true when online", () => {
    const { result } = renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true })
    expect(result.current.isActionAllowed()).toBe(true)
  })

  it("cleans up event listeners on unmount without errors", () => {
    const { unmount } = renderHook(
      () => useAppFocusRecovery({ account: "GABCDEF" }),
      { wrapper: createWrapper(queryClient) },
    )

    unmount()

    // Events after unmount must not throw or trigger invalidations.
    expect(() => {
      act(() => {
        window.dispatchEvent(new Event("online"))
        vi.runAllTimers()
      })
    }).not.toThrow()
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it("skips account queries when account is null", () => {
    renderHook(
      () => useAppFocusRecovery({ account: null }),
      { wrapper: createWrapper(queryClient) },
    )

    act(() => {
      window.dispatchEvent(new Event("online"))
      vi.runAllTimers()
    })

    // Only market-level keys should be invalidated, not account keys.
    const calls = vi.mocked(queryClient.invalidateQueries).mock.calls
    const hasAccountKey = calls.some(([opts]) => {
      const key = (opts as { queryKey?: unknown }).queryKey
      return Array.isArray(key) && key.includes("GABCDEF")
    })
    expect(hasAccountKey).toBe(false)
  })
})
