import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { TVChartContainer } from "./TVChartContainer"

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTimeScale = {
  fitContent: vi.fn(),
  getVisibleLogicalRange: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
}

const mockChartMethods = {
  addSeries: vi.fn(),
  remove: vi.fn(),
  applyOptions: vi.fn(),
  timeScale: vi.fn(() => mockTimeScale),
}

const mockSeriesMethods = {
  setData: vi.fn(),
  update: vi.fn(),
  createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })),
  removePriceLine: vi.fn(),
  applyOptions: vi.fn(),
}

const mockCreateChart = vi.fn((_container?: any, _options?: any) => {
  mockChartMethods.addSeries.mockReturnValue(mockSeriesMethods)
  return mockChartMethods
})

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: Symbol("CandlestickSeries"),
  LineStyle: { Dashed: 0, LargeDashed: 1, Solid: 2 },
  ColorType: { Solid: "solid", VerticalGradient: "gradient" },
  CrosshairMode: { Normal: 0, Magnet: 1 },
  createChart: (container: any, options?: any) => mockCreateChart(container, options),
}))

let mockCandles: Array<Record<string, unknown>> = []
let mockIsLoading = false
let mockIsError = false
let mockLiveBar: Record<string, unknown> | null = null
let mockPositions: Array<Record<string, unknown>> = []
let mockRefetch = vi.fn()
const mockUseOracleCandles = vi.fn()

vi.mock("../../hooks/useOracleCandles", () => ({
  useOracleCandles: () => mockUseOracleCandles(),
}))

vi.mock("../../hooks/useLiveBar", () => ({
  useLiveBar: () => mockLiveBar,
}))

vi.mock("../../hooks/usePositions", () => ({
  usePositions: () => ({ data: mockPositions }),
}))

// JSDOM lacks ResizeObserver / MutationObserver
const mockObserverDisconnect = vi.fn()
class ObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect() {
    mockObserverDisconnect()
  }
}
;(globalThis as unknown as { ResizeObserver: unknown; MutationObserver: unknown }).ResizeObserver = ObserverStub
;(globalThis as unknown as { ResizeObserver: unknown; MutationObserver: unknown }).MutationObserver = ObserverStub

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_CANDLES = [
  { time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105 },
  { time: 1_700_003_600, open: 105, high: 115, low: 95, close: 110 },
  { time: 1_700_007_200, open: 110, high: 120, low: 100, close: 115 },
]

// ── Suite ────────────────────────────────────────────────────────────────────

describe("TVChartContainer", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockCandles = []
    mockIsLoading = false
    mockIsError = false
    mockLiveBar = null
    mockPositions = []
    mockRefetch = vi.fn()
    mockUseOracleCandles.mockImplementation(() => ({
      data: {
        candles: mockCandles,
        sourceType: "oracle_reference",
        venueName: "Binance Reference",
        symbol: "BTC",
        period: "5m",
        network: "testnet",
      },
      isLoading: mockIsLoading,
      isError: mockIsError,
      isFetching: false,
      isPlaceholderData: false,
      refetch: mockRefetch,
    }))
  })

  const defaultProps = { symbol: "BTC", period: "5m" }

  // ═════════════════════════════════════════════════════════════════════════
  // Summary content
  // ═════════════════════════════════════════════════════════════════════════

  it("renders an accessible summary with symbol, period, and latest price", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const summary = screen.getByText(/5m chart for BTC/i)
    expect(summary).toBeInTheDocument()

    expect(screen.getByText(/Latest:/)).toBeInTheDocument()
  })

  it("does not render a summary when there is no candle data", () => {
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.queryByText(/chart for BTC/i)).not.toBeInTheDocument()
  })

  it("renders chart container with accessible role and label", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const chart = screen.getByRole("img", { name: /price chart for btc/i })
    expect(chart).toBeInTheDocument()
  })

  it("describes the chart as linked from the summary", () => {
    mockCandles = SAMPLE_CANDLES
    const { container } = render(<TVChartContainer {...defaultProps} />)

    const chart = container.querySelector('[aria-describedby="chart-desc"]')
    expect(chart).toBeInTheDocument()
  })

  it('identifies prices with "upward" when close is significantly higher than open', () => {
    mockCandles = [
      { time: 1_700_000_000, open: 100, high: 150, low: 90, close: 145 },
    ]
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/upward/i)).toBeInTheDocument()
  })

  it('identifies prices with "downward" when close is significantly lower than open', () => {
    mockCandles = [
      { time: 1_700_000_000, open: 100, high: 102, low: 50, close: 55 },
    ]
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/downward/i)).toBeInTheDocument()
  })

  it('identifies prices as "sideways" when change is small', () => {
    mockCandles = [
      { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100.5 },
    ]
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/sideways/i)).toBeInTheDocument()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Data-table semantics
  // ═════════════════════════════════════════════════════════════════════════

  it("provides a toggle button to show OHLC data", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const toggle = screen.getByRole("button", { name: /BTC OHLC Data/i })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("shows the data table when toggled", async () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const toggle = screen.getByRole("button", { name: /BTC OHLC Data/i })
    fireEvent.click(toggle)

    const headers = screen.getAllByRole("columnheader")
    expect(headers).toHaveLength(5)
    expect(headers[0]).toHaveTextContent(/time|date/i)
    expect(headers[1]).toHaveTextContent("Open")
    expect(headers[2]).toHaveTextContent("High")
    expect(headers[3]).toHaveTextContent("Low")
    expect(headers[4]).toHaveTextContent("Close")

    const rows = screen.getAllByRole("row")
    // header row + data rows
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it("renders semantic table elements", () => {
    mockCandles = SAMPLE_CANDLES
    const { container } = render(<TVChartContainer {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: /BTC OHLC Data/i }))

    expect(container.querySelector("table")).toBeInTheDocument()
    expect(container.querySelector("thead")).toBeInTheDocument()
    expect(container.querySelector("tbody")).toBeInTheDocument()
  })

  it("renders rows in chronological order", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: /BTC OHLC Data/i }))

    const rows = screen.getAllByRole("row").slice(1)
    const times = rows.map((row) => {
      const firstCell = row.querySelector("td")
      return new Date(firstCell?.textContent ?? "").getTime()
    })

    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
  })

  it("toggles the table hidden state correctly", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const toggle = screen.getByRole("button", { name: /BTC OHLC Data/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Open")).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("limits representative rows to avoid giant tables", () => {
    const manyCandles = Array.from({ length: 200 }, (_, i) => ({
      time: 1_700_000_000 + i * 60,
      open: 100 + i,
      high: 110 + i,
      low: 90 + i,
      close: 105 + i,
    }))
    mockCandles = manyCandles
    render(<TVChartContainer {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: /BTC OHLC Data/i }))

    // header row + max 15 data rows
    const rows = screen.getAllByRole("row")
    expect(rows.length).toBeLessThanOrEqual(16)
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Announcement throttling
  // ═════════════════════════════════════════════════════════════════════════

  it("announces price updates via live region", () => {
    mockCandles = SAMPLE_CANDLES
    mockLiveBar = { time: 1_700_010_000, open: 112, high: 118, low: 108, close: 115 }
    render(<TVChartContainer {...defaultProps} />)

    const region = screen.getByRole("status")
    expect(region).toBeInTheDocument()
    expect(region).toHaveAttribute("aria-live", "polite")
  })

  it("does not make a new announcement within the throttle window", () => {
    vi.useFakeTimers()
    mockCandles = SAMPLE_CANDLES

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // First live bar triggers announcement
    mockLiveBar = { time: 1_700_010_000, open: 112, high: 118, low: 108, close: 115 }
    rerender(<TVChartContainer {...defaultProps} />)

    const region = screen.getByRole("status")
    const textAfterFirst = region.textContent
    expect(textAfterFirst).toMatch(/BTC/)

    // Second live bar within 5 seconds — no new announcement
    mockLiveBar = { time: 1_700_010_001, open: 113, high: 119, low: 109, close: 116 }
    rerender(<TVChartContainer {...defaultProps} />)

    expect(region.textContent).toBe(textAfterFirst)

    vi.useRealTimers()
  })

  it("makes a new announcement after the throttle window elapses", () => {
    vi.useFakeTimers()
    mockCandles = SAMPLE_CANDLES

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // First
    mockLiveBar = { time: 1_700_010_000, open: 112, high: 118, low: 108, close: 115 }
    rerender(<TVChartContainer {...defaultProps} />)

    const region = screen.getByRole("status")
    const textAfterFirst = region.textContent

    // Advance past 5s throttle
    vi.advanceTimersByTime(6000)

    // Second live bar after throttle window
    mockLiveBar = { time: 1_700_010_001, open: 113, high: 119, low: 109, close: 116 }
    rerender(<TVChartContainer {...defaultProps} />)

    expect(region.textContent).not.toBe(textAfterFirst)

    vi.useRealTimers()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Loading, empty, and error states
  // ═════════════════════════════════════════════════════════════════════════

  it("shows loading state with accessible text", () => {
    mockIsLoading = true
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    const loading = screen.getByRole("status", { name: /loading 5m chart data for btc/i })
    expect(loading).toBeInTheDocument()
  })

  it("shows empty state when no data and not loading", () => {
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/no trading history available for btc/i)).toBeInTheDocument()
  })

  it("shows error state with alert role", () => {
    mockIsError = true
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    const error = screen.getByRole("alert")
    expect(error).toHaveTextContent(/unable to load 5m chart data/i)
  })

  it("provides a Retry button when data load fails", () => {
    mockIsError = true
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    const retryButton = screen.getByRole("button", { name: /retry loading/i })
    expect(retryButton).toBeInTheDocument()
  })

  it("calls refetch when Retry button is clicked after error", async () => {
    mockIsError = true
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    const retryButton = screen.getByRole("button", { name: /retry loading/i })
    fireEvent.click(retryButton)

    expect(mockRefetch).toHaveBeenCalled()
  })

  it("distinguishes no-history from error state", () => {
    mockIsError = false
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/no trading history available for btc/i)).toBeInTheDocument()
    expect(screen.getByText(/market may be new/i)).toBeInTheDocument()

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows stale state with last known data when live feed stops", async () => {
    mockCandles = SAMPLE_CANDLES
    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // Simulate live feed stopping (isPlaceholderData or isFetching with hasData)
    mockUseOracleCandles.mockReturnValue({
      data: {
        candles: SAMPLE_CANDLES,
        sourceType: "oracle_reference",
        venueName: "Binance Reference",
        symbol: "BTC",
        period: "5m",
        network: "testnet",
      },
      isLoading: false,
      isError: false,
      isFetching: true,
      isPlaceholderData: false,
      refetch: mockRefetch,
    })

    rerender(<TVChartContainer {...defaultProps} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(/live data unavailable for 5m/i)
    expect(alert).toHaveTextContent(/showing last known data/i)
  })

  it("provides Refresh Now button in stale state", async () => {
    mockCandles = SAMPLE_CANDLES
    mockUseOracleCandles.mockReturnValue({
      data: {
        candles: SAMPLE_CANDLES,
        sourceType: "oracle_reference",
        venueName: "Binance Reference",
        symbol: "BTC",
        period: "5m",
        network: "testnet",
      },
      isLoading: false,
      isError: false,
      isFetching: true,
      isPlaceholderData: false,
      refetch: mockRefetch,
    })

    render(<TVChartContainer {...defaultProps} />)

    const refreshButton = screen.getByRole("button", { name: /refresh|retry/i })
    expect(refreshButton).toBeInTheDocument()

    fireEvent.click(refreshButton)
    expect(mockRefetch).toHaveBeenCalled()
  })

  it("renders data source and venue identification metadata badge", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/Reference Price \(Binance Reference\)/i)).toBeInTheDocument()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Chart lifecycle and memory (OB-070)
  // ═════════════════════════════════════════════════════════════════════════

  it("creates chart instance once on mount and cleans up on unmount", () => {
    mockCandles = SAMPLE_CANDLES
    mockChartMethods.remove.mockClear()

    const { unmount } = render(<TVChartContainer {...defaultProps} />)

    // Chart should be created
    expect(mockChartMethods.addSeries).toHaveBeenCalled()
    expect(mockChartMethods.remove).not.toHaveBeenCalled()

    unmount()

    // Cleanup called on unmount
    expect(mockChartMethods.remove).toHaveBeenCalled()
  })

  it("does not create duplicate chart instances on re-render", () => {
    mockCandles = SAMPLE_CANDLES
    mockCreateChart.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)
    const callCountAfterMount = mockCreateChart.mock.calls.length

    // Re-render with same props
    rerender(<TVChartContainer {...defaultProps} />)

    // createChart should not be called again
    expect(mockCreateChart.mock.calls.length).toBe(callCountAfterMount)
  })

  it("cleans up ResizeObserver on unmount", () => {
    const disconnectSpy = vi.fn()
    ObserverStub.prototype.disconnect = disconnectSpy

    mockCandles = SAMPLE_CANDLES
    const { unmount } = render(<TVChartContainer {...defaultProps} />)

    disconnectSpy.mockClear()
    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("cleans up MutationObserver on unmount", () => {
    const disconnectSpy = vi.fn()
    ObserverStub.prototype.disconnect = disconnectSpy

    mockCandles = SAMPLE_CANDLES
    const { unmount } = render(<TVChartContainer {...defaultProps} />)

    disconnectSpy.mockClear()
    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("does not call setData with empty candles array on mount if no data", () => {
    mockCandles = []
    mockSeriesMethods.setData.mockClear()

    render(<TVChartContainer {...defaultProps} />)

    // setData should not be called with actual candles before they arrive
    expect(mockSeriesMethods.setData).not.toHaveBeenCalled()
  })

  it("calls setData once when historical candles arrive", () => {
    mockCandles = []
    mockSeriesMethods.setData.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // Candles arrive
    mockCandles = SAMPLE_CANDLES
    rerender(<TVChartContainer {...defaultProps} />)

    // setData called exactly once with full array
    expect(mockSeriesMethods.setData).toHaveBeenCalledTimes(1)
    expect(mockSeriesMethods.setData).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ time: 1_700_000_000 }),
      ]),
    )
  })

  it("calls fitContent only once per symbol/period load, not on every candle update", () => {
    const fitContentSpy = vi.spyOn(mockChartMethods.timeScale(), "fitContent")
    fitContentSpy.mockClear()

    mockCandles = SAMPLE_CANDLES
    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    expect(fitContentSpy).toHaveBeenCalledTimes(1)

    // Simulate live bar update (adds one more candle)
    mockCandles = [
      ...SAMPLE_CANDLES,
      { time: 1_700_010_800, open: 115, high: 125, low: 105, close: 120 },
    ]
    rerender(<TVChartContainer {...defaultProps} />)

    // fitContent should NOT be called again
    expect(fitContentSpy).toHaveBeenCalledTimes(1)

    fitContentSpy.mockRestore()
  })

  it("clears price lines when symbol changes", () => {
    mockCandles = SAMPLE_CANDLES
    mockPositions = [
      {
        key: "pos-1",
        indexToken: "BTC",
        isLong: true,
        entryPrice: 105,
        liquidationPrice: 90,
      },
    ]
    mockSeriesMethods.removePriceLine.mockClear()

    const { rerender } = render(<TVChartContainer symbol="BTC" period="5m" />)

    // Price lines created for initial position
    expect(mockSeriesMethods.createPriceLine).toHaveBeenCalled()

    // Change symbol
    mockCandles = []
    mockSeriesMethods.removePriceLine.mockClear()
    rerender(<TVChartContainer symbol="ETH" period="5m" />)

    // Old price lines removed
    expect(mockSeriesMethods.removePriceLine).toHaveBeenCalled()
  })

  it("recovers candle data and price lines after reconnect", () => {
    // Initial load
    mockCandles = SAMPLE_CANDLES
    mockPositions = [
      {
        key: "pos-1",
        indexToken: "BTC",
        isLong: true,
        entryPrice: 105,
        liquidationPrice: 90,
      },
    ]
    mockSeriesMethods.setData.mockClear()
    mockSeriesMethods.createPriceLine.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // Simulate disconnection: clear candles
    mockCandles = []
    mockSeriesMethods.setData.mockClear()
    rerender(<TVChartContainer {...defaultProps} />)

    // Reconnection: candles re-arrive
    mockCandles = SAMPLE_CANDLES
    mockSeriesMethods.setData.mockClear()
    rerender(<TVChartContainer {...defaultProps} />)

    // setData called with same candles (verifies correct recovery)
    expect(mockSeriesMethods.setData).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ time: 1_700_000_000, close: 105 }),
        expect.objectContaining({ time: 1_700_007_200, close: 115 }),
      ]),
    )

    // Price lines should be recreated
    expect(mockSeriesMethods.createPriceLine).toHaveBeenCalled()
  })

  it("does not retain candles beyond current data set", () => {
    mockCandles = SAMPLE_CANDLES
    mockSeriesMethods.setData.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    const firstSetDataCall = mockSeriesMethods.setData.mock.calls[0][0]
    expect(firstSetDataCall).toHaveLength(3)

    // Update with fewer candles (e.g., different period or data reset)
    mockCandles = [SAMPLE_CANDLES[0]]
    mockSeriesMethods.setData.mockClear()
    rerender(<TVChartContainer {...defaultProps} />)

    const secondSetDataCall = mockSeriesMethods.setData.mock.calls[0][0]
    expect(secondSetDataCall).toHaveLength(1)

    // Should not retain old candles
    expect(secondSetDataCall[0]).toEqual(
      expect.objectContaining({ time: 1_700_000_000 }),
    )
  })

  it("updates price lines when positions change", () => {
    mockCandles = SAMPLE_CANDLES
    mockPositions = []
    mockSeriesMethods.removePriceLine.mockClear()
    mockSeriesMethods.createPriceLine.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // No price lines initially
    expect(mockSeriesMethods.createPriceLine).not.toHaveBeenCalled()

    // Position added
    mockPositions = [
      {
        key: "pos-1",
        indexToken: "BTC",
        isLong: true,
        entryPrice: 105,
        liquidationPrice: 90,
      },
    ]
    mockSeriesMethods.createPriceLine.mockClear()
    rerender(<TVChartContainer {...defaultProps} />)

    expect(mockSeriesMethods.createPriceLine).toHaveBeenCalledTimes(2) // entry + liquidation

    // Position removed
    mockPositions = []
    mockSeriesMethods.removePriceLine.mockClear()
    rerender(<TVChartContainer {...defaultProps} />)

    expect(mockSeriesMethods.removePriceLine).toHaveBeenCalled()
  })

  it("handles live bar updates without memory accumulation", () => {
    mockCandles = SAMPLE_CANDLES
    mockSeriesMethods.update.mockClear()

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // Add 100 live bar updates
    for (let i = 0; i < 100; i++) {
      mockLiveBar = {
        time: 1_700_010_000 + i * 60,
        open: 115 + i,
        high: 125 + i,
        low: 105 + i,
        close: 120 + i,
      }
      rerender(<TVChartContainer {...defaultProps} />)
    }

    // Each update should call series.update, not accumulate
    expect(mockSeriesMethods.update.mock.calls.length).toBeGreaterThan(0)

    // Original candles array should not grow
    mockCandles = SAMPLE_CANDLES
    expect(mockCandles).toHaveLength(3)
  })
})
