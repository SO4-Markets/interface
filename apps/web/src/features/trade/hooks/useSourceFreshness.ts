import { useEffect, useState } from "react"
import { marketSubscriptionManager } from "../lib/market-data-stream"
import type { FreshnessResult } from "../lib/source-freshness"
import type { SourceHealth } from "./useSourceHealth"

export type SourceFreshnessView = {
  health: SourceHealth
  freshness: FreshnessResult
}

/** How often freshness is re-evaluated. Silence has no event, so it has to be polled. */
export const FRESHNESS_TICK_MS = 1_000

/**
 * OB-049: Live source health and freshness for a symbol's order book feed.
 *
 * Staleness is the ABSENCE of messages, which raises no event, so the state is
 * re-evaluated on a timer as well as whenever the book changes. Re-renders are
 * limited to visible changes: a new state, reason or message, or a change in
 * the whole seconds shown once the feed is not fresh.
 */
export function useSourceFreshness(symbol: string | undefined): SourceFreshnessView | null {
  const [view, setView] = useState<SourceFreshnessView | null>(null)

  useEffect(() => {
    if (!symbol) {
      setView(null)
      return
    }

    const shared = marketSubscriptionManager.getOrCreate(symbol)
    let lastKey = ""

    const evaluate = () => {
      const next = shared.getSourceHealth(Date.now())
      const { freshness, health } = next
      const shownSeconds =
        freshness.state === "fresh" || health.staleDuration === null
          ? ""
          : Math.floor(health.staleDuration / 1000)
      const key = `${freshness.state}|${freshness.reason}|${freshness.canSeedQuote}|${health.message}|${shownSeconds}`
      if (key === lastKey) return
      lastKey = key
      setView(next)
    }

    // Subscribing keeps the shared stream alive and re-evaluates on every book change.
    const unsubscribe = shared.subscribeBook(evaluate)
    const timer = setInterval(evaluate, FRESHNESS_TICK_MS)
    evaluate()

    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [symbol])

  return view
}
