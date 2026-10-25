import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useClipboard } from "./use-clipboard"

const RESET_AFTER = 1000

describe("useClipboard", () => {
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

  it("starts in idle status", () => {
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )
    expect(result.current.status).toBe("idle")
  })

  it("sets status to copied on success", async () => {
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    let ok = false
    await act(async () => {
      ok = await result.current.copy("hello")
    })

    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith("hello")
    expect(result.current.status).toBe("copied")
  })

  it("resets to idle after the timeout", async () => {
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    await act(async () => {
      await result.current.copy("hello")
    })
    expect(result.current.status).toBe("copied")

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER)
    })
    expect(result.current.status).toBe("idle")
  })

  it("sets status to failed when clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    let ok = true
    await act(async () => {
      ok = await result.current.copy("hello")
    })

    expect(ok).toBe(false)
    expect(result.current.status).toBe("failed")
  })

  it("resets failed status after the timeout", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    await act(async () => {
      await result.current.copy("hello")
    })
    expect(result.current.status).toBe("failed")

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER)
    })
    expect(result.current.status).toBe("idle")
  })

  it("clears previous timer on repeated clicks", async () => {
    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    await act(async () => {
      await result.current.copy("first")
    })

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })

    await act(async () => {
      await result.current.copy("second")
    })

    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })
    expect(result.current.status).toBe("copied")

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER / 2)
    })
    expect(result.current.status).toBe("idle")
  })

  it("ignores a stale clipboard result when a newer copy starts", async () => {
    let resolveFirst: (() => void) | undefined
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    writeText
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValueOnce(undefined)

    const { result } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )
    let firstCopy: Promise<boolean> | undefined
    await act(async () => {
      firstCopy = result.current.copy("first")
      await result.current.copy("second")
    })

    expect(result.current.status).toBe("copied")
    resolveFirst?.()
    await act(async () => {
      await firstCopy
    })
    expect(result.current.status).toBe("copied")
  })

  it("cleans up timer on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useClipboard({ resetAfter: RESET_AFTER })
    )

    await act(async () => {
      await result.current.copy("hello")
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(RESET_AFTER)
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
