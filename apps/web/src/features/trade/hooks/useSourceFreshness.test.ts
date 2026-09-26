import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FRESHNESS_TICK_MS, useSourceFreshness } from "./useSourceFreshness"
import type { FreshnessResult } from "../lib/source-freshness"
import type { SourceHealth } from "./useSourceHealth"

type View = { health: SourceHealth; freshness: FreshnessResult }

const freshness = (over: Partial<FreshnessResult> = {}): FreshnessResult => ({
  state: "fresh",
  reason: "live",
  canSeedQuote: true,
  lastMessageAgeMs: 0,
  lastValidUpdateAgeMs: 0,
  providerLagMs: 0,
  clockOffsetMs: 40,
  ...over,
})

const health = (over: Partial<SourceHealth> = {}): SourceHealth => ({
  status: "connected",
  lastUpdateTime: 1,
  staleDuration: null,
  reconnectAttempt: 0,
  isExecutable: true,
  message: "Live market data",
  ...over,
})

let current: View
const unsubscribe = vi.fn()
let bookListener: (() => void) | null = null
const getOrCreate = vi.fn()

vi.mock("../lib/market-data-stream", () => ({
  marketSubscriptionManager: { getOrCreate: (...args: Array<unknown>) => getOrCreate(...args) },
}))

beforeEach(() => {
  vi.useFakeTimers()
  current = { health: health(), freshness: freshness() }
  bookListener = null
  unsubscribe.mockReset()
  getOrCreate.mockReset()
  getOrCreate.mockReturnValue({
    getSourceHealth: () => current,
    subscribeBook: (cb: () => void) => {
      bookListener = cb
      return unsubscribe
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useSourceFreshness", () => {
  it("returns null without a symbol and does not subscribe", () => {
    const { result } = renderHook(() => useSourceFreshness(undefined))
    expect(result.current).toBeNull()
    expect(getOrCreate).not.toHaveBeenCalled()
  })

  it("reports the current freshness on mount", () => {
    const { result } = renderHook(() => useSourceFreshness("BTC"))
    expect(result.current?.freshness.state).toBe("fresh")
    expect(result.current?.health.status).toBe("connected")
  })

  it("notices silence, which raises no event, on its timer", () => {
    const { result } = renderHook(() => useSourceFreshness("BTC"))
    expect(result.current?.freshness.state).toBe("fresh")

    current = {
      health: health({ status: "stale", staleDuration: 21_000, isExecutable: false, message: "No data received — connection may be dead" }),
      freshness: freshness({ state: "stale", reason: "transport-silent", canSeedQuote: false }),
    }
    act(() => {
      vi.advanceTimersByTime(FRESHNESS_TICK_MS)
    })

    expect(result.current?.freshness).toMatchObject({ state: "stale", reason: "transport-silent" })
  })

  it("re-evaluates immediately when the book changes, not only on the timer", () => {
    const { result } = renderHook(() => useSourceFreshness("BTC"))
    current = {
      health: health({ status: "reconnecting", isExecutable: false, message: "Reconnecting to market data…" }),
      freshness: freshness({ state: "reconnecting", reason: "transport-closed", canSeedQuote: false }),
    }
    act(() => bookListener?.())
    expect(result.current?.freshness.state).toBe("reconnecting")
  })

  it("does not re-render while nothing visible changed", () => {
    let renders = 0
    renderHook(() => {
      renders++
      return useSourceFreshness("BTC")
    })
    const afterMount = renders

    // The ages move every tick, but the state, reason and message are the same.
    for (let i = 1; i <= 10; i++) {
      current = {
        health: health(),
        freshness: freshness({ lastMessageAgeMs: i * 1_000, lastValidUpdateAgeMs: i * 1_000 }),
      }
      act(() => {
        vi.advanceTimersByTime(FRESHNESS_TICK_MS)
      })
    }
    expect(renders).toBe(afterMount)
  })

  it("re-renders each whole second once the feed is stale, so the shown age stays right", () => {
    current = {
      health: health({ status: "stale", staleDuration: 21_000, isExecutable: false, message: "stale" }),
      freshness: freshness({ state: "stale", reason: "transport-silent", canSeedQuote: false }),
    }
    const { result } = renderHook(() => useSourceFreshness("BTC"))
    expect(result.current?.health.staleDuration).toBe(21_000)

    current = { ...current, health: { ...current.health, staleDuration: 22_000 } }
    act(() => {
      vi.advanceTimersByTime(FRESHNESS_TICK_MS)
    })
    expect(result.current?.health.staleDuration).toBe(22_000)
  })

  it("stops its timer and unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useSourceFreshness("BTC"))
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("switches subscription when the symbol changes", () => {
    const { rerender } = renderHook(({ symbol }) => useSourceFreshness(symbol), {
      initialProps: { symbol: "BTC" },
    })
    rerender({ symbol: "ETH" })
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(getOrCreate).toHaveBeenLastCalledWith("ETH")
  })

  it("clears the view when the symbol goes away", () => {
    const { result, rerender } = renderHook(({ symbol }) => useSourceFreshness(symbol), {
      initialProps: { symbol: "BTC" },
    })
    expect(result.current).not.toBeNull()
    rerender({ symbol: undefined })
    expect(result.current).toBeNull()
  })
})
