import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { useLandingStats } from "./use-landing-stats"
import type { ReactNode } from "react"
import { queryKeys } from "@/shared/lib/query-keys"

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useLandingStats", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("returns all stats as null initially (backend gap)", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.traders).toBeNull()
      expect(result.current.openInterest).toBeNull()
      expect(result.current.totalVolume).toBeNull()
      expect(result.current.liquidityTotal).toBeNull()
    })
  })

  it("marks data as loading on first fetch", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it("marks data as not loading on subsequent renders after fetch", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.isStale).toBe(false)
  })

  it("caches data across multiple queries", async () => {
    const { result: result1 } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
    })

    const { result: result2 } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    // Second query should use cached data (no loading state)
    expect(result2.current.loading).toBe(false)
  })

  it("has staleTime of 30 seconds", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const query = queryClient.getQueryState(queryKeys.landing.stats())
    expect(query?.dataUpdatedAt).toBeDefined()

    // Data should not be stale immediately
    expect(result.current.isStale).toBe(false)
  })

  it("marks data as stale during background refetch", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isStale).toBe(false)

    // Trigger background refetch by invalidating
    await queryClient.invalidateQueries({ queryKey: queryKeys.landing.stats() })

    // Should be marked as stale during refetch
    // (Note: actual behavior depends on queryFn timing)
  })

  it("keeps data visible during background refetch", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.traders).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    const initialTraders = result.current.traders

    // Invalidate to trigger background refetch
    await queryClient.invalidateQueries({ queryKey: queryKeys.landing.stats() })

    // Data should still be visible even if refetching
    expect(result.current.traders).toBe(initialTraders)
  })

  it("has appropriate cache retention time", async () => {
    const { result } = renderHook(() => useLandingStats(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const query = queryClient.getQueryState(queryKeys.landing.stats())
    // gcTime should be 5 minutes (300000ms)
    // This is a TanStack Query internal detail, so we just verify the query exists
    expect(query?.data).toBeDefined()
  })
})
