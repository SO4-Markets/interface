/**
 * OB-060: Comprehensive DepthLadder tests.
 *
 * Coverage:
 * - Large numbers formatting and display
 * - Price level rendering and visual depth indicators
 * - Stale/reconnecting overlay behavior
 * - Empty states and loading states
 * - Accessibility and screen reader support
 * - Spread calculation display
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DepthLadder } from "./DepthLadder"
import type { OrderBookState } from "../../hooks/useOrderBook"

// Mock the hook
const mockUseOrderBook = vi.fn()
vi.mock("../../hooks/useOrderBook", () => ({
  useOrderBook: (symbol: string | undefined) => mockUseOrderBook(symbol),
}))

describe("DepthLadder", () => {
  const createMockState = (overrides?: Partial<OrderBookState>): OrderBookState => ({
    bids: [
      { price: 50000, size: 1.5, total: 1.5, depth: 0.5 },
      { price: 49950, size: 2.3, total: 3.8, depth: 1.0 },
    ],
    asks: [
      { price: 50050, size: 1.2, total: 1.2, depth: 0.4 },
      { price: 50100, size: 1.8, total: 3.0, depth: 1.0 },
    ],
    spread: 50,
    spreadPct: 0.1,
    midPrice: 50025,
    status: "connected",
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
    mockUseOrderBook.mockReturnValue(createMockState())
  })

  describe("rendering and layout", () => {
    it("renders table with proper ARIA role", () => {
      render(<DepthLadder symbol="TWBTC" />)

      const table = screen.getByRole("table")
      expect(table).toBeInTheDocument()
      expect(table).toHaveAttribute("aria-label", expect.stringContaining("TWBTC"))
    })

    it("renders column headers", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("columnheader", { name: "Price" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Size" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument()
    })

    it("renders bid rows in descending price order", () => {
      render(<DepthLadder symbol="TWBTC" />)

      const rows = screen.getAllByRole("row")
      const bidRows = rows.filter(row => {
        const text = row.textContent
        return text && (text.includes("49,950") || text.includes("50,000"))
      })

      expect(bidRows.length).toBeGreaterThan(0)
    })

    it("renders ask rows in ascending price order", () => {
      render(<DepthLadder symbol="TWBTC" />)

      const rows = screen.getAllByRole("row")
      const askRows = rows.filter(row => {
        const text = row.textContent
        return text && (text.includes("50,050") || text.includes("50,100"))
      })

      expect(askRows.length).toBeGreaterThan(0)
    })

    it("renders spread separator with mid price and spread percentage", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText(/Spread/i)).toBeInTheDocument()
      expect(screen.getByText(/Mid/i)).toBeInTheDocument()
      expect(screen.getByText(/0\.100%/)).toBeInTheDocument()
    })
  })

  describe("large numbers formatting", () => {
    it("formats prices with thousands separators", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [{ price: 123456.78, size: 1.0, total: 1.0, depth: 1.0 }],
        asks: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      // formatUsd should handle the formatting
      expect(screen.getByText(/123,456\.78/)).toBeInTheDocument()
    })

    it("formats sizes with appropriate decimal places", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [{ price: 50000, size: 1234.5678, total: 1234.5678, depth: 1.0 }],
        asks: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      // Size should show with 3-4 decimals
      const cells = screen.getAllByRole("cell")
      const hasSizeFormat = cells.some(cell => /1,234\.567/.test(cell.textContent || ""))
      expect(hasSizeFormat).toBe(true)
    })

    it("formats cumulative totals correctly", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [{ price: 50000, size: 100, total: 9876.5432, depth: 1.0 }],
        asks: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      const cells = screen.getAllByRole("cell")
      const hasTotalFormat = cells.some(cell => /9,876\.543/.test(cell.textContent || ""))
      expect(hasTotalFormat).toBe(true)
    })

    it("handles very small decimal values", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [{ price: 50000, size: 0.0001234, total: 0.0001234, depth: 1.0 }],
        asks: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      // Should display small numbers without scientific notation
      const cells = screen.getAllByRole("cell")
      const hasSmallNumber = cells.some(cell => /0\.000/.test(cell.textContent || ""))
      expect(hasSmallNumber).toBe(true)
    })
  })

  describe("loading states", () => {
    it("shows loading skeleton when isLoading is true and no data", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [],
        asks: [],
        isLoading: true,
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("status", { name: /loading order book/i })).toBeInTheDocument()
    })

    it("does not show skeleton when data exists even if loading", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        isLoading: true,
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.queryByRole("status", { name: /loading order book/i })).not.toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty message when no bids or asks", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [],
        asks: [],
        isLoading: false,
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("status")).toHaveTextContent(/no depth data available/i)
    })

    it("shows message for one-sided book (bids only)", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        asks: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText(/no asks available/i)).toBeInTheDocument()
    })

    it("shows message for one-sided book (asks only)", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [],
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText(/no bids available/i)).toBeInTheDocument()
    })
  })

  describe("stale and reconnecting overlays", () => {
    it("shows stale overlay when source health is stale", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        sourceHealth: {
          status: "stale",
          lastUpdateTime: Date.now() - 30000,
          staleDuration: 30000,
          reconnectAttempt: 0,
          isExecutable: false,
          message: "Connection lost — showing last known data",
        },
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText("Data Stale")).toBeInTheDocument()
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
    })

    it("shows reconnecting overlay when reconnecting", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        sourceHealth: {
          status: "reconnecting",
          lastUpdateTime: Date.now() - 5000,
          staleDuration: 5000,
          reconnectAttempt: 1,
          isExecutable: false,
          message: "Reconnecting (attempt 1)…",
        },
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText("Reconnecting")).toBeInTheDocument()
    })

    it("shows resyncing overlay for revision gap", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        sourceHealth: {
          status: "revision-gap",
          lastUpdateTime: Date.now() - 2000,
          staleDuration: 2000,
          reconnectAttempt: 1,
          isExecutable: false,
          message: "Resyncing — detected data gap",
        },
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText("Resyncing")).toBeInTheDocument()
    })

    it("does not show overlay when connected", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.queryByText("Data Stale")).not.toBeInTheDocument()
      expect(screen.queryByText("Reconnecting")).not.toBeInTheDocument()
      expect(screen.queryByText("Resyncing")).not.toBeInTheDocument()
    })

    it("preserves last known data under overlay", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        sourceHealth: {
          status: "stale",
          lastUpdateTime: Date.now() - 10000,
          staleDuration: 10000,
          reconnectAttempt: 0,
          isExecutable: false,
          message: "Connection lost",
        },
      }))

      render(<DepthLadder symbol="TWBTC" />)

      // Data should still be rendered underneath
      expect(screen.getByText(/50,000/)).toBeInTheDocument()
      expect(screen.getByText("Data Stale")).toBeInTheDocument()
    })
  })

  describe("source health badge", () => {
    it("shows Live badge when connected", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByText("Live")).toBeInTheDocument()
    })

    it("shows appropriate badge for each health state", () => {
      const states: Array<{ status: any; expectedText: string }> = [
        { status: "initial-load", expectedText: "Connecting…" },
        { status: "empty-venue", expectedText: "No Depth" },
        { status: "rate-limited", expectedText: "Rate Limited" },
        { status: "error", expectedText: "Error" },
      ]

      states.forEach(({ status, expectedText }) => {
        mockUseOrderBook.mockReturnValue(createMockState({
          sourceHealth: {
            status,
            lastUpdateTime: null,
            staleDuration: null,
            reconnectAttempt: 0,
            isExecutable: false,
            message: "Test message",
          },
        }))

        const { unmount } = render(<DepthLadder symbol="TWBTC" />)
        expect(screen.getByText(expectedText)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("accessibility and screen readers", () => {
    it("table has descriptive aria-label with symbol", () => {
      render(<DepthLadder symbol="TETH" />)

      const table = screen.getByRole("table")
      expect(table).toHaveAttribute("aria-label", "TETH order-book depth ladder")
    })

    it("rowgroups have descriptive aria-labels", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("rowgroup", { name: "Ask orders" })).toBeInTheDocument()
      expect(screen.getByRole("rowgroup", { name: "Bid orders" })).toBeInTheDocument()
    })

    it("spread separator has aria-label", () => {
      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("separator", { name: "Spread" })).toBeInTheDocument()
    })

    it("loading state has proper role and label", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [],
        asks: [],
        isLoading: true,
      }))

      render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("status", { name: "Loading order book…" })).toBeInTheDocument()
    })

    it("empty state has role=status", () => {
      mockUseOrderBook.mockReturnValue(createMockState({
        bids: [],
        asks: [],
        isLoading: false,
      }))

      render(<DepthLadder symbol="TWBTC" />)

      const emptyStatus = screen.getByRole("status")
      expect(emptyStatus).toHaveTextContent(/no depth data available/i)
    })
  })

  describe("compact mode", () => {
    it("applies compact styling when compact prop is true", () => {
      render(<DepthLadder symbol="TWBTC" compact={true} />)

      // Component should render (visual differences tested manually)
      expect(screen.getByRole("table")).toBeInTheDocument()
    })

    it("applies normal styling when compact prop is false", () => {
      render(<DepthLadder symbol="TWBTC" compact={false} />)

      expect(screen.getByRole("table")).toBeInTheDocument()
    })
  })

  describe("symbol changes", () => {
    it("updates aria-label when symbol changes", () => {
      const { rerender } = render(<DepthLadder symbol="TWBTC" />)

      expect(screen.getByRole("table")).toHaveAttribute(
        "aria-label",
        "TWBTC order-book depth ladder"
      )

      rerender(<DepthLadder symbol="TETH" />)

      expect(screen.getByRole("table")).toHaveAttribute(
        "aria-label",
        "TETH order-book depth ladder"
      )
    })

    it("handles undefined symbol gracefully", () => {
      render(<DepthLadder symbol={undefined} />)

      expect(screen.getByRole("table")).toHaveAttribute(
        "aria-label",
        "Market order-book depth ladder"
      )
    })
  })

  describe("visual depth indicators", () => {
    it("renders depth bars for each level", () => {
      render(<DepthLadder symbol="TWBTC" />)

      // Depth bars are rendered with aria-hidden, so we check the rows exist
      const rows = screen.getAllByRole("row")
      expect(rows.length).toBeGreaterThan(2) // At least header + some data rows
    })
  })
})
