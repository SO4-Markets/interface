import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { DepthChart } from "./DepthChart"
import type { OrderBookLevel } from "../../hooks/useOrderBook"

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockChartMethods = {
  addSeries: vi.fn(),
  remove: vi.fn(),
  applyOptions: vi.fn(),
  timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
}

const mockSeriesMethods = {
  setData: vi.fn(),
  applyOptions: vi.fn(),
}

vi.mock("lightweight-charts", () => ({
  AreaSeries: Symbol("AreaSeries"),
  createChart: vi.fn(() => {
    mockChartMethods.addSeries.mockReturnValue(mockSeriesMethods)
    return mockChartMethods
  }),
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

const SAMPLE_BIDS: Array<OrderBookLevel> = [
  { price: 100, size: 1, total: 1, depth: 0.5 },
  { price: 99, size: 2, total: 3, depth: 1 },
]

const SAMPLE_ASKS: Array<OrderBookLevel> = [
  { price: 101, size: 1, total: 1, depth: 0.33 },
  { price: 102, size: 2, total: 3, depth: 1 },
]

describe("DepthChart", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const defaultProps = {
    symbol: "BTC",
    bids: SAMPLE_BIDS,
    asks: SAMPLE_ASKS,
    isLoading: false,
    status: "connected" as const,
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Chart rendering and accessibility
  // ═════════════════════════════════════════════════════════════════════════

  it("renders with accessible title and status", () => {
    render(<DepthChart {...defaultProps} />)

    expect(screen.getByText(/BTC Cumulative Depth/i)).toBeInTheDocument()
    expect(screen.getByText(/Live/i)).toBeInTheDocument()
  })

  it("displays connection status indicators", () => {
    const { rerender } = render(<DepthChart {...defaultProps} status="connecting" />)
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument()

    rerender(<DepthChart {...defaultProps} status="disconnected" />)
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument()

    rerender(<DepthChart {...defaultProps} status="error" />)
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument()

    rerender(<DepthChart {...defaultProps} status="connected" />)
    expect(screen.getByText(/Live/i)).toBeInTheDocument()
  })

  it("renders accessible summary description", () => {
    const { container } = render(<DepthChart {...defaultProps} />)

    const summary = container.querySelector('[id="depth-chart-desc"]')
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveTextContent(/2 bid levels/)
    expect(summary).toHaveTextContent(/2 ask levels/)
  })

  it("shows loading state", () => {
    render(
      <DepthChart
        {...defaultProps}
        isLoading={true}
        bids={[]}
        asks={[]}
      />,
    )

    expect(screen.getByRole("status", { name: /loading depth chart/i })).toBeInTheDocument()
  })

  it("shows empty state when no data", () => {
    render(
      <DepthChart
        {...defaultProps}
        bids={[]}
        asks={[]}
        isLoading={false}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(/no depth data available/i)
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Data table fallback
  // ═════════════════════════════════════════════════════════════════════════

  it("provides expandable data table fallback", () => {
    render(<DepthChart {...defaultProps} />)

    const toggle = screen.getByRole("button", { name: /BTC Cumulative Depth/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    toggle.click()

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Bid")).toBeInTheDocument()
    expect(screen.getByText("Ask")).toBeInTheDocument()
  })

  it("shows price, size, and cumulative total in table", () => {
    render(<DepthChart {...defaultProps} />)

    screen.getByRole("button", { name: /BTC Cumulative Depth/i }).click()

    // Check headers
    expect(screen.getByText("Type")).toBeInTheDocument()
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Size")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()

    // Check data is rendered
    const rows = screen.getAllByRole("row")
    // header + 2 bids + 2 asks = 5 rows
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Chart lifecycle (OB-070)
  // ═════════════════════════════════════════════════════════════════════════

  it("creates chart instance once and cleans up on unmount", () => {
    mockChartMethods.remove.mockClear()

    const { unmount } = render(<DepthChart {...defaultProps} />)

    expect(mockChartMethods.addSeries).toHaveBeenCalledTimes(2) // bids + asks

    mockChartMethods.remove.mockClear()
    unmount()

    expect(mockChartMethods.remove).toHaveBeenCalled()
  })

  it("does not create duplicate chart instances on re-render", () => {
    mockChartMethods.addSeries.mockClear()
    const { rerender } = render(<DepthChart {...defaultProps} />)

    const callCountAfterMount = mockChartMethods.addSeries.mock.calls.length

    rerender(<DepthChart {...defaultProps} />)

    // addSeries should not be called again
    expect(mockChartMethods.addSeries.mock.calls.length).toBe(callCountAfterMount)
  })

  it("updates series data when bids change", () => {
    mockSeriesMethods.setData.mockClear()

    const { rerender } = render(<DepthChart {...defaultProps} />)

    const firstCallCount = mockSeriesMethods.setData.mock.calls.length

    const newBids = [...SAMPLE_BIDS, { price: 98, size: 3, total: 6, depth: 1 }]
    mockSeriesMethods.setData.mockClear()

    rerender(
      <DepthChart
        {...defaultProps}
        bids={newBids}
      />,
    )

    // Should update with new data
    expect(mockSeriesMethods.setData).toHaveBeenCalled()
  })

  it("updates series data when asks change", () => {
    mockSeriesMethods.setData.mockClear()

    const { rerender } = render(<DepthChart {...defaultProps} />)

    const newAsks = [...SAMPLE_ASKS, { price: 103, size: 3, total: 6, depth: 1 }]
    mockSeriesMethods.setData.mockClear()

    rerender(
      <DepthChart
        {...defaultProps}
        asks={newAsks}
      />,
    )

    // Should update with new data
    expect(mockSeriesMethods.setData).toHaveBeenCalled()
  })

  it("handles one-sided depth (bids only)", () => {
    render(
      <DepthChart
        {...defaultProps}
        bids={SAMPLE_BIDS}
        asks={[]}
      />,
    )

    expect(screen.getByText(/1 bid levels/i)).toBeInTheDocument()
  })

  it("handles one-sided depth (asks only)", () => {
    render(
      <DepthChart
        {...defaultProps}
        bids={[]}
        asks={SAMPLE_ASKS}
      />,
    )

    expect(screen.getByText(/1 ask levels/i)).toBeInTheDocument()
  })

  it("recovers and displays data after reconnect", () => {
    // Initial load with data
    const { rerender } = render(<DepthChart {...defaultProps} />)

    // Disconnect: no data
    mockSeriesMethods.setData.mockClear()
    rerender(
      <DepthChart
        {...defaultProps}
        bids={[]}
        asks={[]}
        status="disconnected"
      />,
    )

    expect(screen.getByText(/no depth data/i)).toBeInTheDocument()

    // Reconnect: data returns
    mockSeriesMethods.setData.mockClear()
    rerender(
      <DepthChart
        {...defaultProps}
        bids={SAMPLE_BIDS}
        asks={SAMPLE_ASKS}
        status="connected"
      />,
    )

    expect(screen.getByText(/Live/i)).toBeInTheDocument()
    expect(mockSeriesMethods.setData).toHaveBeenCalled()
  })

  it("does not retain stale depth data between views", () => {
    const { rerender } = render(<DepthChart {...defaultProps} />)

    screen.getByRole("button", { name: /BTC Cumulative Depth/i }).click()
    expect(screen.getByText(/100/i)).toBeInTheDocument() // bid price

    // Switch to new data set
    const newBids = [{ price: 200, size: 5, total: 5, depth: 1 }]
    mockSeriesMethods.setData.mockClear()
    rerender(
      <DepthChart
        {...defaultProps}
        bids={newBids}
        asks={[]}
      />,
    )

    // Old data should not be in table
    expect(screen.queryByText("100")).not.toBeInTheDocument()
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("cleans up observers on unmount", () => {
    const observerStub = (ObserverStub as any).prototype
    const disconnectSpy = vi.spyOn(observerStub, "disconnect")

    const { unmount } = render(<DepthChart {...defaultProps} />)

    disconnectSpy.mockClear()
    unmount()

    expect(disconnectSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
    disconnectSpy.mockRestore()
  })
})
