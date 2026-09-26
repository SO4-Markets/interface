import { create } from "zustand"
import { persist } from "zustand/middleware"

// OB-069: Persist chart preferences (timeframe, display mode) without storing
// live prices, positions, or market-specific data. Use versioning to handle
// schema migration and corrupt storage recovery.

const SUPPORTED_PERIODS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const
export type Period = (typeof SUPPORTED_PERIODS)[number]

const SUPPORTED_CHART_VIEWS = ["book", "trades", "chart"] as const
type SupportedChartView = (typeof SUPPORTED_CHART_VIEWS)[number]

const CHART_PREFERENCES_VERSION = 1

export interface ChartPreferencesState {
  /** Chart timeframe: 1m, 5m, 15m, 1h, 4h, 1D. Defaults to 5m. */
  period: Period
  /** Active orderbook panel view: book/trades/chart. Defaults to "trades". */
  orderbookView: SupportedChartView
  setPeriod: (value: Period) => void
  setOrderbookView: (value: SupportedChartView) => void
  reset: () => void
}

const CHART_PREFERENCES_DEFAULTS: Pick<
  ChartPreferencesState,
  "period" | "orderbookView"
> = {
  period: "5m",
  orderbookView: "trades",
}

// Recovery function: validates and clamps persisted values to supported set.
// Corrupt or old settings fall back to defaults.
function recoverPreferences(
  persisted: unknown,
): Pick<ChartPreferencesState, "period" | "orderbookView"> {
  if (typeof persisted !== "object" || persisted === null) {
    return CHART_PREFERENCES_DEFAULTS
  }

  const obj = persisted as Record<string, unknown>

  // Validate period is in supported set
  const period = SUPPORTED_PERIODS.includes(obj.period as Period)
    ? (obj.period as Period)
    : CHART_PREFERENCES_DEFAULTS.period

  // Validate orderbookView is one of the allowed values
  const orderbookView = SUPPORTED_CHART_VIEWS.includes(obj.orderbookView as SupportedChartView)
    ? (obj.orderbookView as SupportedChartView)
    : CHART_PREFERENCES_DEFAULTS.orderbookView

  return { period, orderbookView }
}

export const useChartPreferencesStore = create<ChartPreferencesState>()(
  persist(
    (set) => ({
      period: CHART_PREFERENCES_DEFAULTS.period,
      orderbookView: CHART_PREFERENCES_DEFAULTS.orderbookView,

      setPeriod: (value: Period) => {
        // Only accept supported periods; silently ignore invalid values
        if (SUPPORTED_PERIODS.includes(value)) {
          set({ period: value })
        }
      },

      setOrderbookView: (value: SupportedChartView) => {
        // Only accept supported views; silently ignore invalid values
        if (SUPPORTED_CHART_VIEWS.includes(value)) {
          set({ orderbookView: value })
        }
      },

      reset: () => {
        set({
          period: CHART_PREFERENCES_DEFAULTS.period,
          orderbookView: CHART_PREFERENCES_DEFAULTS.orderbookView,
        })
      },
    }),
    {
      name: "chart-preferences",
      version: CHART_PREFERENCES_VERSION,

      // Validate and recover persisted state on hydration.
      // Corrupt settings (invalid period/view) revert to defaults without error.
      merge: (persisted, current) => ({
        ...current,
        ...recoverPreferences(persisted),
      }),
    }
  )
)
