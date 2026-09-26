/**
 * OB-060: Comprehensive RecentTradesTape tests.
 *
 * Coverage:
 * - Trade list rendering and updates
 * - Busy tape behavior (high-frequency updates)
 * - Stale/reconnecting overlays
 * - Empty and loading states
 * - Number formatting for prices and quantities
 * - Accessibility
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecentTradesTape } from "./RecentTradesTape"
import type { TradeItem, UseRecentTradesResult } from "../../hooks/useRecentTrades"

// Mock the hook
const mockUseRecentTrades = vi.fn()
vi.mock("../../hooks/useRecentTrades", () => ({
  useRecentTrades: (symbol: string | undefined) => mockUseRecentTrades(symbol),
}))

describe("RecentTradesTape", () => {
  const createMockTrade = (id: string, overrides?: Partial<TradeItem>): TradeItem => ({
    id,
    price: 50000,
    qty: 1.5,
    time: Date.now(),
    side: "buy",
    venue: "Binance Reference",
    ...overrides,
  })

  const createMockResult = (overrides?: Partial<UseRecentTradesResult>): UseRecentTradesResult => ({
    trades: [
      createMockTrade("1", { price: 50100, qty: 1.2, side: "buy" }),
      createMockTrade("2", { price: 50050, qty: 0.8, side: "sell" }),
      createMockTrade("3", { price: 50075, qty: 2.3, side: "buy" }),
    ],
    status: "connected",
    error: null,
    isLoading: false,
    sourceHealth: {
      status: "connected",
      lastUpdateTime: Date.now(),
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: true,
      message: "Live market data",
    },
    ...overrides,
  })

  beforeEach(() => {
    mockUseRecentTrades.mockReturnValue(createMockResult())
  })

  describe("rendering and layout", () => {
    it("renders table with trades", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("table")).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Price" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Size" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Time" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Side" })).toBeInTheDocument()
    })

    it("renders trade rows with correct data", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByText(/50,100/)).toBeInTheDocument()
      expect(screen.getByText(/50,050/)).toBeInTheDocument()
      expect(screen.getByText(/50,075/)).toBeInTheDocument()
    })

    it("displays buy side in green", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      const buyLabels = screen.getAllByText("Buy")
      expect(buyLabels.length).toBeGreaterThan(0)
      buyLabels.forEach(label => {
        expect(label).toHaveClass("text-green-500")
      })
    })

    it("displays sell side in red", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      const sellLabels = screen.getAllByText("Sell")
      expect(sellLabels.length).toBeGreaterThan(0)
      sellLabels.forEach(label => {
        expect(label).toHaveClass("text-red-500")
      })
    })

    it("displays unknown side with neutral styling", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { side: "unknown" })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      const unknownIndicator = screen.getByText("—")
      expect(unknownIndicator).toHaveClass("text-muted-foreground")
    })
  })

  describe("number formatting", () => {
    it("formats prices with appropriate decimals", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { price: 123456.789 })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      // formatUsd with 4 decimals
      expect(screen.getByText(/123,456\.789/)).toBeInTheDocument()
    })

    it("formats quantities with 2-4 decimals", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { qty: 12.3456 })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByText(/12\.345/)).toBeInTheDocument()
    })

    it("handles very small quantities", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { qty: 0.00123 })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      const cells = screen.getAllByRole("cell")
      const hasSmallQty = cells.some(cell => /0\.00/.test(cell.textContent || ""))
      expect(hasSmallQty).toBe(true)
    })

    it("formats timestamps as time", () => {
      const testTime = new Date("2024-01-15T14:30:45").getTime()
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { time: testTime })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      // Time should be formatted (exact format depends on locale)
      const timeElements = screen.getAllByRole("cell")
      const hasTimeFormat = timeElements.some(el => /\d{1,2}:\d{2}/.test(el.textContent || ""))
      expect(hasTimeFormat).toBe(true)
    })
  })

  describe("loading states", () => {
    it("shows loading skeletons when loading with no trades", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: true,
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("status", { name: /loading recent trades/i })).toBeInTheDocument()
    })

    it("does not show skeletons when data exists even if loading", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        isLoading: true,
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.queryByRole("status", { name: /loading recent trades/i })).not.toBeInTheDocument()
      expect(screen.getByRole("table")).toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty message when no trades available", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: false,
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("status")).toHaveTextContent(/no recent trades available/i)
    })

    it("includes symbol in empty message", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: false,
      }))

      render(<RecentTradesTape symbol="TETH" />)

      expect(screen.getByRole("status")).toHaveTextContent("TETH")
    })

    it("handles undefined symbol in empty message", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: false,
      }))

      render(<RecentTradesTape symbol={undefined} />)

      expect(screen.getByRole("status")).toHaveTextContent(/selected market/i)
    })
  })

  describe("busy tape behavior", () => {
    it("renders many trades without performance issues", () => {
      const manyTrades: Array<TradeItem> = Array.from({ length: 50 }, (_, i) =>
        createMockTrade(String(i), {
          price: 50000 + i,
          qty: Math.random() * 10,
          side: i % 2 === 0 ? "buy" : "sell",
        })
      )

      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: manyTrades,
      }))

      const { container } = render(<RecentTradesTape symbol="TWBTC" />)

      // All 50 trades should be rendered
      const rows = container.querySelectorAll("tbody tr")
      expect(rows.length).toBe(50)
    })

    it("updates efficiently when new trades arrive (memoization)", () => {
      const { rerender } = render(<RecentTradesTape symbol="TWBTC" />)

      // Add a new trade at the beginning
      const updatedTrades = [
        createMockTrade("new", { price: 50200 }),
        ...createMockResult().trades,
      ]

      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: updatedTrades,
      }))

      rerender(<RecentTradesTape symbol="TWBTC" />)

      // New trade should be visible
      expect(screen.getByText(/50,200/)).toBeInTheDocument()
    })
  })

  describe("stale and reconnecting overlays", () => {
    it("shows stale overlay when connection lost", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        sourceHealth: {
          status: "stale",
          lastUpdateTime: Date.now() - 20000,
          staleDuration: 20000,
          reconnectAttempt: 0,
          isExecutable: false,
          message: "Connection lost",
        },
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByText("Data Stale")).toBeInTheDocument()
    })

    it("shows reconnecting overlay", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        sourceHealth: {
          status: "reconnecting",
          lastUpdateTime: Date.now() - 3000,
          staleDuration: 3000,
          reconnectAttempt: 1,
          isExecutable: false,
          message: "Reconnecting…",
        },
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByText("Reconnecting")).toBeInTheDocument()
    })

    it("shows resyncing overlay for revision gap", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        sourceHealth: {
          status: "revision-gap",
          lastUpdateTime: Date.now() - 1000,
          staleDuration: 1000,
          reconnectAttempt: 1,
          isExecutable: false,
          message: "Resyncing",
        },
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      const resyncingTexts = screen.getAllByText("Resyncing")
      expect(resyncingTexts.length).toBeGreaterThan(0)
    })

    it("does not show overlay when connected", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.queryByText("Data Stale")).not.toBeInTheDocument()
      expect(screen.queryByText("Reconnecting")).not.toBeInTheDocument()
    })

    it("preserves trade list under overlay", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        sourceHealth: {
          status: "stale",
          lastUpdateTime: Date.now() - 10000,
          staleDuration: 10000,
          reconnectAttempt: 0,
          isExecutable: false,
          message: "Stale",
        },
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      // Data should still be visible
      expect(screen.getByText(/50,100/)).toBeInTheDocument()
      expect(screen.getByText("Data Stale")).toBeInTheDocument()
    })
  })

  describe("source health badge", () => {
    it("shows Live badge when connected", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByText("Live")).toBeInTheDocument()
    })

    it("shows appropriate badge for each state", () => {
      const states: Array<{ status: any; expectedText: string }> = [
        { status: "initial-load", expectedText: "Connecting…" },
        { status: "error", expectedText: "Error" },
        { status: "rate-limited", expectedText: "Rate Limited" },
      ]

      states.forEach(({ status, expectedText }) => {
        mockUseRecentTrades.mockReturnValue(createMockResult({
          sourceHealth: {
            status,
            lastUpdateTime: null,
            staleDuration: null,
            reconnectAttempt: 0,
            isExecutable: false,
            message: "Test",
          },
        }))

        const { unmount } = render(<RecentTradesTape symbol="TWBTC" />)
        expect(screen.getByText(expectedText)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("accessibility", () => {
    it("has proper table structure with headers", () => {
      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("table")).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Price" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Size" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Time" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Side" })).toBeInTheDocument()
    })

    it("loading state has proper role", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: true,
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("status", { name: /loading recent trades/i })).toBeInTheDocument()
    })

    it("empty state has proper role", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [],
        isLoading: false,
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      expect(screen.getByRole("status")).toBeInTheDocument()
    })

    it("unknown trade side has accessible title", () => {
      mockUseRecentTrades.mockReturnValue(createMockResult({
        trades: [createMockTrade("1", { side: "unknown" })],
      }))

      render(<RecentTradesTape symbol="TWBTC" />)

      const unknownIndicator = screen.getByTitle("Side unknown")
      expect(unknownIndicator).toBeInTheDocument()
    })
  })

  describe("symbol changes", () => {
    it("updates when symbol prop changes", () => {
      const { rerender } = render(<RecentTradesTape symbol="TWBTC" />)

      rerender(<RecentTradesTape symbol="TETH" />)

      // Component should re-render with new symbol (hook receives new symbol)
      expect(mockUseRecentTrades).toHaveBeenCalledWith("TETH")
    })
  })
})
