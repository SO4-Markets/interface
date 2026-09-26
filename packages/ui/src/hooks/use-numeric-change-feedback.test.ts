import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNumericChangeFeedback } from "./use-numeric-change-feedback"

describe("useNumericChangeFeedback (OB-019)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("initializes without emphasis", () => {
    const { result } = renderHook(() => useNumericChangeFeedback({ value: 100 }))
    expect(result.current.trend).toBe("none")
    expect(result.current.isEmphasized).toBe(false)
  })

  it("detects upward change and applies positive emphasis", () => {
    const { result, rerender } = renderHook(
      ({ val }) => useNumericChangeFeedback({ value: val }),
      { initialProps: { val: 100 } }
    )

    rerender({ val: 105 })
    expect(result.current.trend).toBe("up")
    expect(result.current.isEmphasized).toBe(true)

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.trend).toBe("none")
    expect(result.current.isEmphasized).toBe(false)
  })

  it("detects downward change and applies negative emphasis", () => {
    const { result, rerender } = renderHook(
      ({ val }) => useNumericChangeFeedback({ value: val }),
      { initialProps: { val: 100 } }
    )

    rerender({ val: 95 })
    expect(result.current.trend).toBe("down")
    expect(result.current.isEmphasized).toBe(true)
  })

  it("coalesces repeated bursts by extending timer without breaking emphasis", () => {
    const { result, rerender } = renderHook(
      ({ val }) => useNumericChangeFeedback({ value: val, coalesceMs: 500 }),
      { initialProps: { val: 100 } }
    )

    rerender({ val: 102 })
    expect(result.current.trend).toBe("up")

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Rapid second update within coalesce window
    rerender({ val: 104 })
    expect(result.current.trend).toBe("up")
    expect(result.current.isEmphasized).toBe(true)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    // Still emphasized because timer was reset
    expect(result.current.isEmphasized).toBe(true)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.isEmphasized).toBe(false)
  })

  it("honors disabled prop (reduced motion)", () => {
    const { result, rerender } = renderHook(
      ({ val, disabled }) => useNumericChangeFeedback({ value: val, disabled }),
      { initialProps: { val: 100, disabled: true } }
    )

    rerender({ val: 110, disabled: true })
    expect(result.current.trend).toBe("none")
    expect(result.current.isEmphasized).toBe(false)
  })
})
