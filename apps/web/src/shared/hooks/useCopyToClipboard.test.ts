import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCopyToClipboard } from "./useCopyToClipboard"

const RESET_AFTER = 1000

describe("useCopyToClipboard", () => {
  let originalClipboard: PropertyDescriptor | undefined
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")
    writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard)
    } else {
      delete (navigator as { clipboard?: Clipboard }).clipboard
    }
    vi.restoreAllMocks()
  })

  it("writes text to the clipboard and toggles copied state", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ resetAfter: RESET_AFTER }),
    )

    let copied = false
    await act(async () => {
      copied = await result.current.copyToClipboard("SO4 address")
    })

    expect(copied).toBe(true)
    expect(writeText).toHaveBeenCalledWith("SO4 address")
    expect(result.current.copied).toBe(true)
  })

  it("resets copied state after the timeout", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ resetAfter: RESET_AFTER }),
    )

    await act(async () => {
      await result.current.copyToClipboard("SO4 address")
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER - 1)
    })
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.copied).toBe(false)
  })

  it("keeps copied false when clipboard writes reject", async () => {
    const error = new Error("permission denied")
    writeText.mockRejectedValue(error)
    const { result } = renderHook(() =>
      useCopyToClipboard({ resetAfter: RESET_AFTER }),
    )
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")

    let copied = true
    await act(async () => {
      copied = await result.current.copyToClipboard("SO4 address")
    })

    expect(copied).toBe(false)
    expect(writeText).toHaveBeenCalledWith("SO4 address")
    expect(result.current.copied).toBe(false)
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it("clears the previous reset timer before scheduling a new one", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ resetAfter: RESET_AFTER }),
    )

    await act(async () => {
      await result.current.copyToClipboard("first")
    })
    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })
    await act(async () => {
      await result.current.copyToClipboard("second")
    })

    expect(writeText).toHaveBeenNthCalledWith(1, "first")
    expect(writeText).toHaveBeenNthCalledWith(2, "second")
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })
    expect(result.current.copied).toBe(false)
  })
})
