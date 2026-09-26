import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { usePendingContent } from "./usePendingContent"

describe("usePendingContent", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("shows skeleton on first load when loading", () => {
    const { result } = renderHook(() => usePendingContent(true, null))

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.shouldShowSkeleton).toBe(true)
    expect(result.current.shouldShowContent).toBe(false)
    expect(result.current.isFirstLoad).toBe(true)
  })

  it("hides skeleton when data arrives", () => {
    const { result, rerender } = renderHook(
      ({ isLoading, hasData }: { isLoading: boolean; hasData: unknown }) =>
        usePendingContent(isLoading, hasData),
      { initialProps: { isLoading: true, hasData: null as unknown } }
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.shouldShowSkeleton).toBe(true)

    rerender({ isLoading: false, hasData: { id: "1" } })

    expect(result.current.shouldShowSkeleton).toBe(false)
    expect(result.current.shouldShowContent).toBe(true)
    expect(result.current.isFirstLoad).toBe(false)
  })

  it("does not show skeleton on background refetch when data exists", () => {
    const { result, rerender } = renderHook(
      ({ isLoading, hasData }: { isLoading: boolean; hasData: unknown }) =>
        usePendingContent(isLoading, hasData),
      { initialProps: { isLoading: false, hasData: { id: "1" } } }
    )

    expect(result.current.isFirstLoad).toBe(false)

    // Simulate background refetch
    rerender({ isLoading: true, hasData: { id: "1" } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.shouldShowSkeleton).toBe(false)
    expect(result.current.shouldShowContent).toBe(true)
  })

  it("prevents skeleton flashing on fast responses", async () => {
    const { result, rerender } = renderHook(
      ({ isLoading, hasData }: { isLoading: boolean; hasData: unknown }) =>
        usePendingContent(isLoading, hasData),
      { initialProps: { isLoading: true, hasData: null as unknown } }
    )

    // Data arrives before delay
    act(() => {
      vi.advanceTimersByTime(100)
    })

    rerender({ isLoading: false, hasData: { id: "1" } })

    expect(result.current.shouldShowSkeleton).toBe(false)
    expect(result.current.shouldShowContent).toBe(true)
  })

  it("respects custom loading delay", () => {
    const { result } = renderHook(() => usePendingContent(true, null, 500))

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.shouldShowSkeleton).toBe(false)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.shouldShowSkeleton).toBe(true)
  })

  it("cleans up timers on unmount", () => {
    const { unmount } = renderHook(() => usePendingContent(true, null))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it("tracks first load correctly after data arrival", () => {
    const { result, rerender } = renderHook(
      ({ isLoading, hasData }: { isLoading: boolean; hasData: unknown }) =>
        usePendingContent(isLoading, hasData),
      { initialProps: { isLoading: true, hasData: null as unknown } }
    )

    expect(result.current.isFirstLoad).toBe(true)

    rerender({ isLoading: false, hasData: { id: "1" } })
    expect(result.current.isFirstLoad).toBe(false)

    // Subsequent loads should not be first load
    rerender({ isLoading: true, hasData: { id: "1" } })
    expect(result.current.isFirstLoad).toBe(false)
  })

  it("shows skeleton again when data is cleared and reloading", () => {
    const { result, rerender } = renderHook(
      ({ isLoading, hasData }: { isLoading: boolean; hasData: unknown }) =>
        usePendingContent(isLoading, hasData),
      { initialProps: { isLoading: false, hasData: { id: "1" } } }
    )

    expect(result.current.isFirstLoad).toBe(false)

    // Data is cleared and reloading
    rerender({ isLoading: true, hasData: null as unknown as { id: string } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.shouldShowSkeleton).toBe(true)
  })
})
