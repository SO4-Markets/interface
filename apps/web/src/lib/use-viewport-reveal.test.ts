import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useViewportReveal } from "./use-viewport-reveal"

describe("useViewportReveal", () => {
  let observerCallback: IntersectionObserverCallback

  beforeEach(() => {
    global.IntersectionObserver = vi.fn((callback) => {
      observerCallback = callback
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as IntersectionObserver
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns a ref object", () => {
    const { result } = renderHook(() => useViewportReveal())
    expect(result.current).toHaveProperty("current")
  })

  it("calls onReveal callback when element enters viewport", () => {
    const onReveal = vi.fn()
    renderHook(() => useViewportReveal({ onReveal }))

    const mockEntry = {
      isIntersecting: true,
      target: document.createElement("div"),
    } as unknown as IntersectionObserverEntry

    observerCallback([mockEntry], {} as IntersectionObserver)
    expect(onReveal).toHaveBeenCalledOnce()
  })

  it("respects once option - only triggers once", () => {
    const onReveal = vi.fn()
    renderHook(() => useViewportReveal({ once: true, onReveal }))

    const mockEntry = {
      isIntersecting: true,
      target: document.createElement("div"),
    } as unknown as IntersectionObserverEntry

    observerCallback([mockEntry], {} as IntersectionObserver)
    observerCallback([mockEntry], {} as IntersectionObserver)

    expect(onReveal).toHaveBeenCalledOnce()
  })

  it("triggers on each intersection when once is false", () => {
    const onReveal = vi.fn()
    renderHook(() => useViewportReveal({ once: false, onReveal }))

    const mockEntry = {
      isIntersecting: true,
      target: document.createElement("div"),
    } as unknown as IntersectionObserverEntry

    observerCallback([mockEntry], {} as IntersectionObserver)
    observerCallback([mockEntry], {} as IntersectionObserver)

    expect(onReveal).toHaveBeenCalledTimes(2)
  })

  it("does not trigger when element is not intersecting", () => {
    const onReveal = vi.fn()
    renderHook(() => useViewportReveal({ onReveal }))

    const mockEntry = {
      isIntersecting: false,
      target: document.createElement("div"),
    } as unknown as IntersectionObserverEntry

    observerCallback([mockEntry], {} as IntersectionObserver)
    expect(onReveal).not.toHaveBeenCalled()
  })

  it("passes threshold to IntersectionObserver", () => {
    renderHook(() => useViewportReveal({ threshold: 0.5 }))

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 })
    )
  })

  it("disconnects observer on unmount", () => {
    const disconnect = vi.fn()
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect,
    } as unknown as IntersectionObserver))

    const { unmount } = renderHook(() => useViewportReveal())
    unmount()

    expect(disconnect).toHaveBeenCalled()
  })
})
