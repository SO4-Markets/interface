import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useReducedMotion } from "./use-reduced-motion"

describe("useReducedMotion", () => {
  let mediaQueryListMock: {
    matches: boolean
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mediaQueryListMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    window.matchMedia = vi.fn((query: string) => {
      if (query === "(prefers-reduced-motion: reduce)") {
        return mediaQueryListMock as any
      }
      throw new Error(`Unexpected matchMedia query: ${query}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns false initially (SSR-safe hydration)", () => {
    const { result } = renderHook(() => useReducedMotion())
    // Initial render before effect runs
    expect(result.current).toBe(false)
  })

  it("syncs to system preference after mount", () => {
    mediaQueryListMock.matches = true
    const { result } = renderHook(() => useReducedMotion())

    act(() => {
      // Trigger the effect
      vi.runOnlyPendingTimers()
    })

    // After effect runs, should reflect the system preference
    expect(result.current).toBe(true)
  })

  it("responds to system preference changes", () => {
    mediaQueryListMock.matches = false
    const { result } = renderHook(() => useReducedMotion())

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(result.current).toBe(false)

    // Simulate user changing their system preference
    act(() => {
      mediaQueryListMock.matches = true
      const changeHandler = mediaQueryListMock.addEventListener.mock.calls.find(
        (call) => call[0] === "change"
      )?.[1] as ((event: Event) => void) | undefined

      if (changeHandler) {
        changeHandler(new Event("change"))
      }
    })

    expect(result.current).toBe(true)
  })

  it("cleans up event listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion())

    act(() => {
      vi.runOnlyPendingTimers()
    })

    unmount()

    // Should have called addEventListener once and removeEventListener once
    expect(mediaQueryListMock.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    )
    expect(mediaQueryListMock.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    )
  })

  it("does not leak timers or listeners on rapid mount/unmount", () => {
    const { rerender, unmount } = renderHook(() => useReducedMotion())

    act(() => {
      vi.runOnlyPendingTimers()
    })

    rerender()

    act(() => {
      vi.runOnlyPendingTimers()
    })

    unmount()

    // removeEventListener should match addEventListener calls to prevent leaks
    const addCalls = mediaQueryListMock.addEventListener.mock.calls.length
    const removeCalls = mediaQueryListMock.removeEventListener.mock.calls.length
    expect(removeCalls).toBe(addCalls)
  })
})
