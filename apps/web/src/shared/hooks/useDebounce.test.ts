import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDebounce } from "./useDebounce"

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500))

    expect(result.current).toBe("initial")
  })

  it("should delay updating value after specified delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    )

    expect(result.current).toBe("initial")

    // Change the value
    rerender({ value: "updated", delay: 500 })

    // Value should not update immediately
    expect(result.current).toBe("initial")

    // Fast-forward time by 499ms
    act(() => { vi.advanceTimersByTime(499) })

    // Value should still not be updated
    expect(result.current).toBe("initial")

    // Fast-forward remaining 1ms to reach 500ms total
    act(() => { vi.advanceTimersByTime(1) })

    // Now value should be updated
    expect(result.current).toBe("updated")
  })

  it("should cancel previous timer when value changes again before delay completes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    )

    expect(result.current).toBe("initial")

    // First change
    rerender({ value: "first", delay: 500 })
    expect(result.current).toBe("initial")

    // Fast-forward 200ms
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe("initial")

    // Second change (should cancel first timer)
    rerender({ value: "second", delay: 500 })
    expect(result.current).toBe("initial")

    // Fast-forward to where first timer would have fired (at 500ms total from initial)
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe("initial")

    // Fast-forward another 200ms (500ms from second change)
    act(() => { vi.advanceTimersByTime(200) })

    // Now second value should be applied
    expect(result.current).toBe("second")
  })

  it("should handle rapid successive changes correctly", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      },
    )

    // Rapid changes
    rerender({ value: "change1", delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: "change2", delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: "change3", delay: 300 })
    act(() => { vi.advanceTimersByTime(100) })

    // All previous timers should be cancelled
    expect(result.current).toBe("initial")

    // After 300ms from last change
    act(() => { vi.advanceTimersByTime(300) })

    // Only the last value should be applied
    expect(result.current).toBe("change3")
  })

  it("should cleanup timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

    const { rerender, unmount } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    )

    // Trigger a value change
    rerender({ value: "updated", delay: 500 })

    // Unmount the hook
    unmount()

    // clearTimeout should have been called by the cleanup function
    expect(clearTimeoutSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
  })

  it("should handle different delay values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 100 },
      },
    )

    rerender({ value: "updated", delay: 100 })
    expect(result.current).toBe("initial")

    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe("updated")

    // Change delay
    rerender({ value: "changed", delay: 200 })
    expect(result.current).toBe("updated")

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe("changed")
  })

  it("should work with different data types", () => {
    // Number type
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }: { value: number; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: 42, delay: 500 },
      },
    )

    numberRerender({ value: 100, delay: 500 })
    expect(numberResult.current).toBe(42)

    act(() => { vi.advanceTimersByTime(500) })
    expect(numberResult.current).toBe(100)

    // Object type
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }: { value: { id: number; name: string }; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: { id: 1, name: "Alice" }, delay: 500 },
      },
    )

    objectRerender({ value: { id: 2, name: "Bob" }, delay: 500 })
    expect(objectResult.current).toEqual({ id: 1, name: "Alice" })

    act(() => { vi.advanceTimersByTime(500) })
    expect(objectResult.current).toEqual({ id: 2, name: "Bob" })
  })

  it("should run all pending timers when advancing to end", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    )

    rerender({ value: "updated", delay: 500 })
    expect(result.current).toBe("initial")

    // Run all timers
    act(() => { vi.runAllTimers() })

    expect(result.current).toBe("updated")
  })
})
