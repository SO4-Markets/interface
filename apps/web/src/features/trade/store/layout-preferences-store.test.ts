import { beforeEach, describe, expect, it } from "vitest"
import {
  BOOK_WIDTH_DEFAULT,
  BOOK_WIDTH_MAX,
  BOOK_WIDTH_MIN,
  CHART_ROW_HEIGHT_DEFAULT,
  CHART_ROW_HEIGHT_MAX,
  CHART_ROW_HEIGHT_MIN,
  TRADE_PANEL_WIDTH_DEFAULT,
  TRADE_PANEL_WIDTH_MAX,
  TRADE_PANEL_WIDTH_MIN,
  useLayoutPreferencesStore,
} from "./layout-preferences-store"

describe("layout-preferences-store", () => {
  beforeEach(() => {
    localStorage.clear()
    useLayoutPreferencesStore.setState({
      chartRowHeight: CHART_ROW_HEIGHT_DEFAULT,
      bookWidth: BOOK_WIDTH_DEFAULT,
      tradePanelWidth: TRADE_PANEL_WIDTH_DEFAULT,
    })
  })

  it("has sensible defaults", () => {
    const state = useLayoutPreferencesStore.getState()
    expect(state.chartRowHeight).toBe(CHART_ROW_HEIGHT_DEFAULT)
    expect(state.bookWidth).toBe(BOOK_WIDTH_DEFAULT)
    expect(state.tradePanelWidth).toBe(TRADE_PANEL_WIDTH_DEFAULT)
  })

  it("clamps chart row height to the min/max bounds", () => {
    useLayoutPreferencesStore.getState().setChartRowHeight(CHART_ROW_HEIGHT_MIN - 100)
    expect(useLayoutPreferencesStore.getState().chartRowHeight).toBe(CHART_ROW_HEIGHT_MIN)

    useLayoutPreferencesStore.getState().setChartRowHeight(CHART_ROW_HEIGHT_MAX + 100)
    expect(useLayoutPreferencesStore.getState().chartRowHeight).toBe(CHART_ROW_HEIGHT_MAX)
  })

  it("clamps book width to the min/max bounds", () => {
    useLayoutPreferencesStore.getState().setBookWidth(BOOK_WIDTH_MIN - 100)
    expect(useLayoutPreferencesStore.getState().bookWidth).toBe(BOOK_WIDTH_MIN)

    useLayoutPreferencesStore.getState().setBookWidth(BOOK_WIDTH_MAX + 100)
    expect(useLayoutPreferencesStore.getState().bookWidth).toBe(BOOK_WIDTH_MAX)
  })

  it("clamps trade panel width to the min/max bounds", () => {
    useLayoutPreferencesStore.getState().setTradePanelWidth(TRADE_PANEL_WIDTH_MIN - 100)
    expect(useLayoutPreferencesStore.getState().tradePanelWidth).toBe(TRADE_PANEL_WIDTH_MIN)

    useLayoutPreferencesStore.getState().setTradePanelWidth(TRADE_PANEL_WIDTH_MAX + 100)
    expect(useLayoutPreferencesStore.getState().tradePanelWidth).toBe(TRADE_PANEL_WIDTH_MAX)
  })

  it("rejects NaN values by falling back to the minimum bound", () => {
    useLayoutPreferencesStore.getState().setChartRowHeight(NaN)
    expect(useLayoutPreferencesStore.getState().chartRowHeight).toBe(CHART_ROW_HEIGHT_MIN)
  })

  it("resetLayout restores all dimensions to their defaults", () => {
    useLayoutPreferencesStore.getState().setChartRowHeight(CHART_ROW_HEIGHT_MAX)
    useLayoutPreferencesStore.getState().setBookWidth(BOOK_WIDTH_MAX)
    useLayoutPreferencesStore.getState().setTradePanelWidth(TRADE_PANEL_WIDTH_MAX)
    useLayoutPreferencesStore.getState().resetLayout()

    const state = useLayoutPreferencesStore.getState()
    expect(state.chartRowHeight).toBe(CHART_ROW_HEIGHT_DEFAULT)
    expect(state.bookWidth).toBe(BOOK_WIDTH_DEFAULT)
    expect(state.tradePanelWidth).toBe(TRADE_PANEL_WIDTH_DEFAULT)
  })

  it("persists changes to localStorage", () => {
    useLayoutPreferencesStore.getState().setTradePanelWidth(400)
    const stored = JSON.parse(localStorage.getItem("trade-layout-preferences") || "{}")
    expect(stored.state.tradePanelWidth).toBe(400)
  })
})
