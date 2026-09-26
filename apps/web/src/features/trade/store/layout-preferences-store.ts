import { create } from "zustand"
import { persist } from "zustand/middleware"

// Issue 685 (OB-038): bounded workspace panel resizing.
//
// Layout is a pure UI preference and is persisted independently of any
// financial/query data — this store never touches TanStack Query's cache
// and TanStack Query never touches this store.

export const CHART_ROW_HEIGHT_MIN = 240
export const CHART_ROW_HEIGHT_MAX = 900
export const CHART_ROW_HEIGHT_DEFAULT = 480

export const BOOK_WIDTH_MIN = 220
export const BOOK_WIDTH_MAX = 420
export const BOOK_WIDTH_DEFAULT = 256

export const TRADE_PANEL_WIDTH_MIN = 280
export const TRADE_PANEL_WIDTH_MAX = 480
export const TRADE_PANEL_WIDTH_DEFAULT = 320

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export interface LayoutPreferencesState {
  /** Height in px of the chart+book row within the left column. */
  chartRowHeight: number
  /** Width in px of the market-depth/book panel next to the chart (desktop only). */
  bookWidth: number
  /** Width in px of the right-hand trade panel column (desktop only). */
  tradePanelWidth: number
  setChartRowHeight: (value: number) => void
  setBookWidth: (value: number) => void
  setTradePanelWidth: (value: number) => void
  resetLayout: () => void
}

export const useLayoutPreferencesStore = create<LayoutPreferencesState>()(
  persist(
    (set) => ({
      chartRowHeight: CHART_ROW_HEIGHT_DEFAULT,
      bookWidth: BOOK_WIDTH_DEFAULT,
      tradePanelWidth: TRADE_PANEL_WIDTH_DEFAULT,
      setChartRowHeight: (value) =>
        set({ chartRowHeight: clamp(value, CHART_ROW_HEIGHT_MIN, CHART_ROW_HEIGHT_MAX) }),
      setBookWidth: (value) => set({ bookWidth: clamp(value, BOOK_WIDTH_MIN, BOOK_WIDTH_MAX) }),
      setTradePanelWidth: (value) =>
        set({ tradePanelWidth: clamp(value, TRADE_PANEL_WIDTH_MIN, TRADE_PANEL_WIDTH_MAX) }),
      resetLayout: () =>
        set({
          chartRowHeight: CHART_ROW_HEIGHT_DEFAULT,
          bookWidth: BOOK_WIDTH_DEFAULT,
          tradePanelWidth: TRADE_PANEL_WIDTH_DEFAULT,
        }),
    }),
    {
      name: "trade-layout-preferences",
      // Re-clamp on read so a layout saved on a large screen (or an older
      // build with different bounds) can't restore out-of-bounds on a
      // smaller viewport. The component further clamps chartRowHeight
      // against the live container size — see useBoundedChartHeight.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<LayoutPreferencesState>) }
        return {
          ...state,
          chartRowHeight: clamp(state.chartRowHeight, CHART_ROW_HEIGHT_MIN, CHART_ROW_HEIGHT_MAX),
          bookWidth: clamp(state.bookWidth, BOOK_WIDTH_MIN, BOOK_WIDTH_MAX),
          tradePanelWidth: clamp(state.tradePanelWidth, TRADE_PANEL_WIDTH_MIN, TRADE_PANEL_WIDTH_MAX),
        }
      },
    }
  )
)
