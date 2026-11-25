import { useEffect, useRef } from "react"
import { toast } from "@workspace/ui/components/toast"
import { usePriceAlertsStore } from "../store/price-alerts-store"
import type { TokenPrice } from "../lib/oracle"

type Props = {
  /**
   * Map of indexTokenAddress (or symbol) → current price.  Pass the `prices`
   * object returned by `useTokenPrices()`.
   */
  prices: Record<string, TokenPrice>
}

/**
 * Mounts in `TradePage` (or any persistent layout component) and silently
 * monitors active price alerts against the live price feed.  When a threshold
 * is crossed:
 *
 * 1. Marks the alert as fired in the store (which also attempts a browser
 *    Notification via `fireNotification`).
 * 2. Falls back to a visible in-app toast when the browser notification
 *    permission has not been granted or the API is unavailable.
 *
 * The watcher never submits transactions or modifies any trade calculation.
 */
export function usePriceAlertWatcher({ prices }: Props) {
  const { alerts, markAlertFired } = usePriceAlertsStore()
  // Keep a ref of already-fired ids in this session to prevent double-firing
  // before the store async persist catches up.
  const firedInSession = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (Object.keys(prices).length === 0) return

    for (const alert of alerts) {
      if (!alert.enabled || alert.firedAt !== null) continue
      if (firedInSession.current.has(alert.id)) continue

      const tokenPrice =
        prices[alert.indexTokenAddress] ?? prices[alert.marketName]
      if (!tokenPrice) continue

      // Use the mid-price (average of min/max) as the reference price so a
      // narrow spread does not cause repeated false triggers.
      const currentPrice = (tokenPrice.min + tokenPrice.max) / 2

      const crossed =
        alert.direction === "above"
          ? currentPrice >= alert.threshold
          : currentPrice <= alert.threshold

      if (!crossed) continue

      firedInSession.current.add(alert.id)
      markAlertFired(alert.id)

      // In-app fallback: always show a toast.  When browser notifications are
      // granted the toast duplicates the native notification, but it is brief
      // and gives the user a visual anchor regardless of focus state.
      const dirLabel = alert.direction === "above" ? "above" : "below"
      toast.info(
        `${alert.marketName} crossed ${dirLabel} ${alert.threshold.toLocaleString()}`,
        {
          description: `Price alert triggered at ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
        },
      )
    }
  }, [alerts, prices, markAlertFired])
}
