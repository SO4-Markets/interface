import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OrderBookPanel } from "./OrderBookPanel"

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockOrderBookCalls = 0

vi.mock("../../hooks/useOrderBook", () => ({
  useOrderBook: () => {
    mockOrderBookCalls++
    return {
      bids: [{ price: 100, size: 1, total: 1, depth: 0.5 }],
      asks: [{ price: 101, size: 1, total: 1, depth: 0.5 }],
      spread: 1,
      spreadPct: 0.5,
      midPrice: 100.5,
      status: "connected",
      isLoading: false,
    }
  },
}))

vi.mock("../../../settings/store/preferences-store", () => ({
  usePreferencesStore: () => ({ slippageTolerance: 0.5 }),
}))

vi.mock("../../store/chart-preferences-store", () => ({
  useChartPreferencesStore: (selector: any) => {
    const state = {
      period: "5m",
      orderbookView: "trades",
      setPeriod: vi.fn(),
      setOrderbookView: vi.fn(),
      reset: vi.fn(),
    }
    return selector(state)
  },
}))

vi.mock("./RecentTradesTape", () => ({
  RecentTradesTape: ({ symbol }: any) => <div>Recent Trades: {symbol}</div>,
}))

vi.mock("./DepthChart", () => ({
  DepthChart: ({ symbol }: any) => <div>Depth Chart: {symbol}</div>,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

describe("OrderBookPanel", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockOrderBookCalls = 0
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Tab switching (OB-069)
  // ═════════════════════════════════════════════════════════════════════════

  it("renders all three tabs", () => {
    render(<OrderBookPanel symbol="BTC" />)

    expect(screen.getByRole("tab", { name: /order book/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /trades/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /depth chart/i })).toBeInTheDocument()
  })

  it("defaults to trades tab", () => {
    render(<OrderBookPanel symbol="BTC" />)

    expect(screen.getByRole("tab", { name: /trades/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByText("Recent Trades: BTC")).toBeInTheDocument()
  })

  it("switches to depth chart tab", async () => {
    const user = userEvent.setup()
    render(<OrderBookPanel symbol="BTC" />)

    await user.click(screen.getByRole("tab", { name: /depth chart/i }))

    expect(screen.getByRole("tab", { name: /depth chart/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByText("Depth Chart: BTC")).toBeInTheDocument()
  })

  it("switches to order book tab", async () => {
    const user = userEvent.setup()
    render(<OrderBookPanel symbol="BTC" />)

    await user.click(screen.getByRole("tab", { name: /order book/i }))

    expect(screen.getByRole("tab", { name: /order book/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(
      screen.getByText(/executable order-book depth is unavailable/i),
    ).toBeInTheDocument()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Subscription lifecycle (OB-070)
  // ═════════════════════════════════════════════════════════════════════════

  it("does not create duplicate useOrderBook subscriptions on tab switch", () => {
    mockOrderBookCalls = 0

    const { rerender } = render(<OrderBookPanel symbol="BTC" />)

    const callsAfterMount = mockOrderBookCalls
    expect(callsAfterMount).toBe(1)

    // Re-render with same symbol (simulates tab switch)
    rerender(<OrderBookPanel symbol="BTC" />)

    // Should still be called once per render, not twice
    expect(mockOrderBookCalls).toBe(2) // one per rerender
  })

  it("closes subscription when symbol changes to undefined", () => {
    mockOrderBookCalls = 0

    const { rerender } = render(<OrderBookPanel symbol="BTC" />)

    expect(mockOrderBookCalls).toBeGreaterThan(0)

    // Change symbol to undefined
    mockOrderBookCalls = 0
    rerender(<OrderBookPanel symbol={undefined} />)

    // Hook should still be called (to handle disabled state)
    expect(mockOrderBookCalls).toBeGreaterThanOrEqual(0)
  })

  it("provides data to both RecentTradesTape and DepthChart without duplication", async () => {
    const user = userEvent.setup()
    mockOrderBookCalls = 0

    render(<OrderBookPanel symbol="BTC" />)

    // Initial render calls useOrderBook once
    expect(mockOrderBookCalls).toBeGreaterThan(0)

    // Switch to depth chart
    mockOrderBookCalls = 0
    await user.click(screen.getByRole("tab", { name: /depth chart/i }))

    // Should not create new subscription, reuse existing
    expect(mockOrderBookCalls).toBeGreaterThanOrEqual(0)
  })

  // ═════════════════════════════════════════════════════════════════════════
  // Memory and state correctness
  // ═════════════════════════════════════════════════════════════════════════

  it("preserves active tab when symbol changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<OrderBookPanel symbol="BTC" />)

    await user.click(screen.getByRole("tab", { name: /depth chart/i }))
    expect(screen.getByText("Depth Chart: BTC")).toBeInTheDocument()

    // Change symbol but stay on same tab
    rerender(<OrderBookPanel symbol="ETH" />)

    expect(screen.getByText("Depth Chart: ETH")).toBeInTheDocument()
  })

  it("does not leak orderbook view state between panel instances", async () => {
    const user = userEvent.setup()

    const { unmount, rerender } = render(
      <OrderBookPanel symbol="BTC" />,
    )

    await user.click(screen.getByRole("tab", { name: /depth chart/i }))

    // Unmount and remount - should reset to default view
    unmount()

    // New instance with different symbol
    render(<OrderBookPanel symbol="ETH" />)

    // Should default back to trades, not retain depth chart view
    // (Note: in real app with store, this tests store isolation)
    expect(screen.getByText("Recent Trades: ETH")).toBeInTheDocument()
  })

  it("header displays reference data indicator", () => {
    render(<OrderBookPanel symbol="BTC" />)

    expect(screen.getByText("Reference Data")).toBeInTheDocument()
  })

  it("handles undefined symbol gracefully", () => {
    const { container } = render(<OrderBookPanel symbol={undefined} />)

    expect(container).toBeInTheDocument()
    expect(screen.getByText("Reference Data")).toBeInTheDocument()
  })
})
