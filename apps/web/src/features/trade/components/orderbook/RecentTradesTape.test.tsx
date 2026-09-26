import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { RecentTradesTape } from "./RecentTradesTape"
import type { UseRecentTradesResult } from "../../hooks/useRecentTrades"

// ── Mock useRecentTrades ──────────────────────────────────────────────────────

let mockResult: UseRecentTradesResult = {
  trades: [],
  status: "connecting",
  error: null,
  isLoading: true,
}

vi.mock("../../hooks/useRecentTrades", () => ({
  useRecentTrades: () => mockResult,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_TRADES = [
  {
    id: "1",
    price: 42_000.5,
    qty: 0.01,
    time: new Date("2024-01-15T10:00:00Z").getTime(),
    side: "buy" as const,
    venue: "Binance Reference",
  },
  {
    id: "2",
    price: 41_990.25,
    qty: 0.5,
    time: new Date("2024-01-15T10:00:01Z").getTime(),
    side: "sell" as const,
    venue: "Binance Reference",
  },
  {
    id: "3",
    price: 41_995,
    qty: 0.25,
    time: new Date("2024-01-15T10:00:02Z").getTime(),
    side: "unknown" as const,
    venue: "Binance Reference",
  },
]

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("RecentTradesTape", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockResult = { trades: [], status: "connecting", error: null, isLoading: true }
  })

  // ── Loading state ─────────────────────────────────────────────────────────

  it("shows a loading skeleton while connecting with no trades", () => {
    mockResult = { trades: [], status: "connecting", error: null, isLoading: true }
    render(<RecentTradesTape symbol="BTC" />)

    const loading = screen.getByRole("status", { name: /loading recent trades/i })
    expect(loading).toBeInTheDocument()
  })

  it("does not show the loading skeleton once trades have arrived even if still connecting", () => {
    mockResult = {
      trades: SAMPLE_TRADES,
      status: "connecting",
      error: null,
      isLoading: true,
    }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument()
  })

  // ── Empty state ───────────────────────────────────────────────────────────

  it("shows an empty-state message when not loading and trades is empty", () => {
    mockResult = { trades: [], status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByRole("status")).toHaveTextContent(/no recent trades available/i)
  })

  it("includes the symbol name in the empty-state message", () => {
    mockResult = { trades: [], status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="ETH" />)

    expect(screen.getByRole("status")).toHaveTextContent(/ETH/)
  })

  it('shows fallback "selected market" text when symbol is undefined', () => {
    mockResult = { trades: [], status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol={undefined} />)

    expect(screen.getByRole("status")).toHaveTextContent(/selected market/i)
  })

  // ── Connected state indicator ─────────────────────────────────────────────

  it('shows "Live" indicator when status is connected', () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByText(/live/i)).toBeInTheDocument()
  })

  it('shows "Connecting" indicator when status is connecting', () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connecting", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it('shows "Disconnected" when status is disconnected', () => {
    mockResult = { trades: SAMPLE_TRADES, status: "disconnected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('shows "Disconnected" when status is error', () => {
    mockResult = {
      trades: [],
      status: "error",
      error: new Error("WebSocket failed"),
      isLoading: false,
    }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  // ── Trade rows ────────────────────────────────────────────────────────────

  it("renders a table with correct column headers when trades are present", () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    expect(screen.getByRole("columnheader", { name: /price/i })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /size/i })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /time/i })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /side/i })).toBeInTheDocument()
  })

  it("renders one row per trade", () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="BTC" />)

    // 1 header row + 3 data rows
    const rows = screen.getAllByRole("row")
    expect(rows).toHaveLength(SAMPLE_TRADES.length + 1)
  })

  it("labels buy trades with 'Buy' text in green", () => {
    mockResult = {
      trades: [SAMPLE_TRADES[0]],
      status: "connected",
      error: null,
      isLoading: false,
    }
    render(<RecentTradesTape symbol="BTC" />)

    const buyCell = screen.getByText("Buy")
    expect(buyCell).toBeInTheDocument()
    expect(buyCell).toHaveClass("text-green-500")
  })

  it("labels sell trades with 'Sell' text in red", () => {
    mockResult = {
      trades: [SAMPLE_TRADES[1]],
      status: "connected",
      error: null,
      isLoading: false,
    }
    render(<RecentTradesTape symbol="BTC" />)

    const sellCell = screen.getByText("Sell")
    expect(sellCell).toBeInTheDocument()
    expect(sellCell).toHaveClass("text-red-500")
  })

  it("renders an em-dash placeholder for unknown-side trades", () => {
    mockResult = {
      trades: [SAMPLE_TRADES[2]],
      status: "connected",
      error: null,
      isLoading: false,
    }
    render(<RecentTradesTape symbol="BTC" />)

    // The em-dash placeholder cell
    const placeholder = screen.getByTitle(/side unknown/i)
    expect(placeholder).toBeInTheDocument()
  })

  it("includes the symbol in the sub-header", () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol="SOL" />)

    expect(screen.getByText(/SOL Trades/i)).toBeInTheDocument()
  })

  it('falls back to "Market" in the sub-header when symbol is undefined', () => {
    mockResult = { trades: SAMPLE_TRADES, status: "connected", error: null, isLoading: false }
    render(<RecentTradesTape symbol={undefined} />)

    expect(screen.getByText(/Market Trades/i)).toBeInTheDocument()
  })
})
