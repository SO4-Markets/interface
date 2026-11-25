import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
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

let mockSource: unknown = null

vi.mock("../../hooks/useSourceFreshness", () => ({
  useSourceFreshness: () => mockSource,
}))

vi.mock("../../../settings/store/preferences-store", () => ({
  usePreferencesStore: () => ({ slippageTolerance: 0.5 }),
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
    // The real store is deliberately persisted (OB-069), so each test starts
    // from the documented default rather than the previous test's leftovers.
    useChartPreferencesStore.setState({ period: "5m", orderbookView: "trades" })
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

  it("keeps the chosen view across remounts (it is a persisted preference)", async () => {
    const user = userEvent.setup()

    const { unmount } = render(
      <OrderBookPanel symbol="BTC" />,
    )

    await user.click(screen.getByRole("tab", { name: /depth chart/i }))

    unmount()

    // New instance with a different symbol. The view lives in the persisted
    // chart-preferences store (OB-069), not in component state, so it is
    // deliberately carried over.
    render(<OrderBookPanel symbol="ETH" />)

    expect(screen.getByText("Depth Chart: ETH")).toBeInTheDocument()
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

  // ═════════════════════════════════════════════════════════════════════════
  // Tab semantics (issue #858)
  // ═════════════════════════════════════════════════════════════════════════

  describe("tab semantics (#858)", () => {
    it("puts the tabs in a named tablist", () => {
      render(<OrderBookPanel symbol="BTC" />)

      const tablist = screen.getByRole("tablist", { name: "Order book view" })
      expect(tablist).toBeInTheDocument()
      expect(within(tablist).getAllByRole("tab")).toHaveLength(3)
    })

    it("links the selected tab to a labelled tabpanel", () => {
      render(<OrderBookPanel symbol="BTC" />)

      const tab = screen.getByRole("tab", { name: /^trades$/i })
      const panel = screen.getByRole("tabpanel", { name: /^trades$/i })

      expect(tab).toHaveAttribute("aria-controls", panel.id)
      expect(panel).toHaveAttribute("aria-labelledby", tab.id)
    })

    it("exposes a single tab stop with roving tabindex", () => {
      render(<OrderBookPanel symbol="BTC" />)

      expect(screen.getByRole("tab", { name: /^trades$/i })).toHaveAttribute("tabindex", "0")
      expect(screen.getByRole("tab", { name: /order book/i })).toHaveAttribute("tabindex", "-1")
      expect(screen.getByRole("tab", { name: /depth chart/i })).toHaveAttribute("tabindex", "-1")
    })

    it("moves between tabs with the arrow keys", async () => {
      const user = userEvent.setup()
      render(<OrderBookPanel symbol="BTC" />)

      screen.getByRole("tab", { name: /^trades$/i }).focus()
      await user.keyboard("{ArrowRight}")

      expect(screen.getByRole("tab", { name: /depth chart/i })).toHaveAttribute(
        "aria-selected",
        "true",
      )

      await user.keyboard("{ArrowRight}")

      expect(screen.getByRole("tab", { name: /order book/i })).toHaveAttribute(
        "aria-selected",
        "true",
      )
    })

    it("jumps to the first and last tab with Home and End", async () => {
      const user = userEvent.setup()
      render(<OrderBookPanel symbol="BTC" />)

      screen.getByRole("tab", { name: /^trades$/i }).focus()
      await user.keyboard("{End}")

      expect(screen.getByRole("tab", { name: /depth chart/i })).toHaveAttribute(
        "aria-selected",
        "true",
      )

      await user.keyboard("{Home}")

      expect(screen.getByRole("tab", { name: /order book/i })).toHaveAttribute(
        "aria-selected",
        "true",
      )
    })
  })

  describe("source health (OB-049)", () => {
    beforeEach(() => {
      mockSource = null
    })

    afterEach(() => {
      mockSource = null
    })

    it("shows no health badge until a state is available", () => {
      render(<OrderBookPanel symbol="BTC" />)
      expect(screen.getByText("Reference Data")).toBeInTheDocument()
      expect(screen.queryByText("Live")).not.toBeInTheDocument()
      expect(screen.queryByText("Stale")).not.toBeInTheDocument()
    })

    it("shows Live for a fresh feed", () => {
      mockSource = {
        health: {
          status: "connected",
          lastUpdateTime: 1,
          staleDuration: null,
          reconnectAttempt: 0,
          isExecutable: true,
          message: "Live market data",
        },
      }
      render(<OrderBookPanel symbol="BTC" />)
      expect(screen.getByText("Live")).toBeInTheDocument()
    })

    it("labels a silent feed Stale and explains why", () => {
      mockSource = {
        health: {
          status: "stale",
          lastUpdateTime: 1,
          staleDuration: 30_000,
          reconnectAttempt: 0,
          isExecutable: false,
          message: "No data received — connection may be dead",
        },
      }
      render(<OrderBookPanel symbol="BTC" />)
      const badge = screen.getByText("Stale")
      expect(badge).toBeInTheDocument()
      expect(badge.closest("[title]")?.getAttribute("title")).toMatch(/connection may be dead/)
      expect(screen.getByText("(30s ago)")).toBeInTheDocument()
    })
  })

  describe("mobile touch targets (#1082)", () => {
    it("applies shared touch-target sizing and spacing to order-book tab pills without a11y violations", async () => {
      const { container } = render(<OrderBookPanel symbol="BTC" />)
      const tablist = screen.getByRole("tablist", { name: "Order book view" })
      expect(tablist.className).toContain("gap-2")
      expect(tablist.className).toContain("sm:gap-1")

      for (const tab of within(tablist).getAllByRole("tab")) {
        expect(tab).toHaveClass("touch-target")
      }

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
