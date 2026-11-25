import { create } from "zustand"
import { persist } from "zustand/middleware"

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertDirection = "above" | "below"

export type PriceAlert = {
  /** Unique alert id (uuid-like, generated at creation). */
  id: string
  /** Market name shown to the user, e.g. "BTC/USD". */
  marketName: string
  /** Index-token address used to look up the live price. */
  indexTokenAddress: string
  /** The price the user set as their threshold. */
  threshold: number
  /** Fire when the price crosses above or below the threshold. */
  direction: AlertDirection
  /** Whether this alert is actively monitored. */
  enabled: boolean
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of when the alert fired, or null if not yet triggered. */
  firedAt: string | null
}

export type AddAlertPayload = Omit<PriceAlert, "id" | "enabled" | "createdAt" | "firedAt">

// ─── Validation ───────────────────────────────────────────────────────────────

export type ThresholdValidationError =
  | "empty"
  | "non-numeric"
  | "zero"
  | "negative"
  | "market-required"

export function validateThreshold(
  raw: string,
  marketName: string,
): ThresholdValidationError | null {
  if (!marketName.trim()) return "market-required"
  if (raw.trim() === "") return "empty"
  const n = Number(raw)
  if (Number.isNaN(n) || !Number.isFinite(n)) return "non-numeric"
  if (n === 0) return "zero"
  if (n < 0) return "negative"
  return null
}

export function thresholdErrorMessage(err: ThresholdValidationError): string {
  switch (err) {
    case "empty":
      return "Enter a price threshold."
    case "non-numeric":
      return "Threshold must be a number."
    case "zero":
      return "Threshold must be greater than zero."
    case "negative":
      return "Threshold must be a positive number."
    case "market-required":
      return "Select a market first."
  }
}

// ─── Notification permission ──────────────────────────────────────────────────

/**
 * Request browser Notification permission.  Returns the resulting permission
 * state ("granted" / "denied" / "default"), or "unavailable" when the
 * Notification API is not present (e.g. SSR, unsupported browser).
 *
 * Never throws — the caller decides how to surface a denial.
 */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unavailable"
> {
  if (typeof Notification === "undefined") return "unavailable"
  if (Notification.permission === "granted") return "granted"
  try {
    return await Notification.requestPermission()
  } catch {
    return "denied"
  }
}

/**
 * Fire a browser notification for a triggered alert, falling back to a
 * no-op when the permission has not been granted (the UI layer handles the
 * in-app fallback independently).
 */
export function fireNotification(alert: PriceAlert): void {
  if (typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return
  try {
    new Notification(`Price alert: ${alert.marketName}`, {
      body: `${alert.marketName} is now ${alert.direction} ${alert.threshold.toLocaleString()}`,
      tag: `price-alert-${alert.id}`,
    })
  } catch {
    // Notification construction can fail in sandboxed environments; ignore.
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

function makeId(): string {
  // crypto.randomUUID() is available in all modern environments; fall back to
  // a simple timestamp+random string to avoid a dependency on a uuid library.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface PriceAlertsState {
  alerts: Array<PriceAlert>
  /**
   * Add a new alert.  Validation must be done before calling this — the store
   * does no additional validation so callers own the error UI.
   */
  addAlert: (payload: AddAlertPayload) => PriceAlert
  /** Permanently remove an alert. */
  removeAlert: (id: string) => void
  /** Toggle the enabled flag for an alert. */
  setAlertEnabled: (id: string, enabled: boolean) => void
  /**
   * Mark an alert as fired (sets firedAt timestamp and disables it so it
   * does not keep firing on every tick).
   */
  markAlertFired: (id: string) => void
  /** Remove all alerts that have already fired. */
  clearFiredAlerts: () => void
}

export const usePriceAlertsStore = create<PriceAlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],

      addAlert(payload) {
        const alert: PriceAlert = {
          ...payload,
          id: makeId(),
          enabled: true,
          createdAt: new Date().toISOString(),
          firedAt: null,
        }
        set((s) => ({ alerts: [...s.alerts, alert] }))
        return alert
      },

      removeAlert(id) {
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
      },

      setAlertEnabled(id, enabled) {
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled } : a)),
        }))
      },

      markAlertFired(id) {
        const firedAt = new Date().toISOString()
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, firedAt, enabled: false } : a,
          ),
        }))
        // Fire browser notification for the matched alert.
        const alert = get().alerts.find((a) => a.id === id)
        if (alert) fireNotification(alert)
      },

      clearFiredAlerts() {
        set((s) => ({ alerts: s.alerts.filter((a) => a.firedAt === null) }))
      },
    }),
    {
      name: "so4-price-alerts-v1",
    },
  ),
)
