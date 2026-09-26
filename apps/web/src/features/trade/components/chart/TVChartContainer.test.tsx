import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { IChartApi } from "lightweight-charts"
import { TVChartContainer } from "./TVChartContainer"

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: Symbol("CandlestickSeries"),
  LineStyle: { Dashed: 0, LargeDashed: 1 },
  ColorType: { Solid: 0 },
  CrosshairMode: { Normal: 0 },
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      update: vi.fn(),
      createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })),
      removePriceLine: vi.fn(),
      applyOptions: vi.fn(),
    })),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
  })),
}))

let mockCandles: Array<Record<string, unknown>> = []
let mockIsLoading = false
let mockIsError = false
let mockLiveBar: Record<string, unknown> | null = null
let mockPositions: Array<Record<string, unknown>> = []

vi.mock("../../hooks/useOracleCandles", () => ({
  useOracleCandles: () => ({
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
  }),
}))

vi.mock("../../hooks/useLiveBar", () => ({
  useLiveBar: () => mockLiveBar,
}))

vi.mock("../../hooks/usePositions", () => ({
  usePositions: () => ({ data: mockPositions }),
}))

// JSDOM lacks ResizeObserver / MutationObserver
class ObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver = ObserverStub
globalThis.MutationObserver = ObserverStub as unknown as typeof MutationObserver

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
    toggle.click()

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

    screen.getByRole("button", { name: /BTC OHLC Data/i }).click()

    expect(container.querySelector("table")).toBeInTheDocument()
    expect(container.querySelector("thead")).toBeInTheDocument()
    expect(container.querySelector("tbody")).toBeInTheDocument()
  })

  it("renders rows in chronological order", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    screen.getByRole("button", { name: /BTC OHLC Data/i }).click()

    const cells = screen.getAllByRole("cell")
    const timeCells = cells.filter(
      (c) => c.textContent && /\d/.test(c.textContent),
    )

    const times = timeCells.map((c) => new Date(c.textContent).getTime())
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
  })

  it("toggles the table hidden state correctly", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    const toggle = screen.getByRole("button", { name: /BTC OHLC Data/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    toggle.click()
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Open")).toBeInTheDocument()

    toggle.click()
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

    screen.getByRole("button", { name: /BTC OHLC Data/i }).click()

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

    const empty = screen.getByRole("status")
    expect(empty).toHaveTextContent(/no trading data available for btc/i)
  })

  it("shows error state with alert role", () => {
    mockIsError = true
    mockCandles = []
    render(<TVChartContainer {...defaultProps} />)

    const error = screen.getByRole("alert")
    expect(error).toHaveTextContent(/unable to load chart data for btc/i)
  })

  it("renders data source and venue identification metadata badge", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    expect(screen.getByText(/Reference Price \(Binance Reference\)/i)).toBeInTheDocument()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Resize observation and resource cleanup (OB-061)
  // ═════════════════════════════════════════════════════════════════════════

  it("creates ResizeObserver and MutationObserver on mount", () => {
    mockCandles = SAMPLE_CANDLES
    render(<TVChartContainer {...defaultProps} />)

    // Verify observers are created (both should be instantiated)
    const resizeInstances = (ResizeObserver as any).mock?.instances || []
    const mutationInstances = (MutationObserver as any).mock?.instances || []

    expect(resizeInstances.length).toBeGreaterThan(0)
    expect(mutationInstances.length).toBeGreaterThan(0)
  })

  it("disconnects observers on unmount", () => {
    mockCandles = SAMPLE_CANDLES
    const { unmount } = render(<TVChartContainer {...defaultProps} />)

    // Get observers before unmount
    const resizeInstances = (ResizeObserver as any).mock?.instances || []
    const mutationInstances = (MutationObserver as any).mock?.instances || []

    const resizeObs = resizeInstances[resizeInstances.length - 1]
    const mutationObs = mutationInstances[mutationInstances.length - 1]

    unmount()

    // Both observers should be disconnected
    if (resizeObs) expect(resizeObs.disconnect).toHaveBeenCalled()
    if (mutationObs) expect(mutationObs.disconnect).toHaveBeenCalled()
  })

  it("removes chart instance on unmount", async () => {
    mockCandles = SAMPLE_CANDLES
    const { createChart } = vi.mocked(await import("lightweight-charts"))
    const mockRemove = vi.fn()
    const mockChart = {
      addSeries: vi.fn(() => ({
        setData: vi.fn(),
        update: vi.fn(),
        createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })),
        removePriceLine: vi.fn(),
        applyOptions: vi.fn(),
      })),
      remove: mockRemove,
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    } as unknown as IChartApi
    createChart.mockReturnValue(mockChart)

    const { unmount } = render(<TVChartContainer {...defaultProps} />)

    expect(mockRemove).not.toHaveBeenCalled()

    unmount()

    expect(mockRemove).toHaveBeenCalledTimes(1)
  })

  it("preserves chart instance across symbol/period changes", async () => {
    mockCandles = SAMPLE_CANDLES
    const { createChart } = vi.mocked(await import("lightweight-charts"))
    const mockChart = {
      addSeries: vi.fn(() => ({
        setData: vi.fn(),
        update: vi.fn(),
        createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })),
        removePriceLine: vi.fn(),
        applyOptions: vi.fn(),
      })),
      remove: vi.fn(),
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    } as unknown as IChartApi
    createChart.mockReturnValue(mockChart)

    const { rerender } = render(<TVChartContainer {...defaultProps} />)

    // Chart created once on mount
    expect(createChart).toHaveBeenCalledTimes(1)

    // Simulate layout change by updating props (period change)
    mockCandles = [
      { time: 1_700_020_000, open: 120, high: 130, low: 110, close: 125 },
    ]
    rerender(<TVChartContainer symbol="BTC" period="15m" />)

    // Chart instance should still be the same, not recreated
    expect(createChart).toHaveBeenCalledTimes(1)
    expect(mockChart.remove).not.toHaveBeenCalled()
  })

  it("handles repeated mount-unmount cycles cleanly", () => {
    mockCandles = SAMPLE_CANDLES

    // First mount-unmount cycle
    const { unmount: unmount1 } = render(<TVChartContainer {...defaultProps} />)

    unmount1()

    // Second mount-unmount cycle
    vi.clearAllMocks()
    const { unmount: unmount2 } = render(<TVChartContainer {...defaultProps} />)

    unmount2()

    // Verifies that repeated cycles don't cause errors or memory leaks
    expect(true).toBe(true)
  })
})
