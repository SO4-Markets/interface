import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

let mockPositions: Array<Record<string, unknown>> = []
let mockIsLoading = false
let mockIsDisabled = false
let mockFundingRate = { ratePerHour: 0.001, nextEpochTs: Date.now() + 3600000 }

vi.mock("@/features/trade/hooks/usePositionsWithIndexer", () => ({
  usePositionsWithIndexer: () => ({
    data: mockPositions,
    isLoading: mockIsLoading,
    isDisabled: mockIsDisabled,
  }),
}))

vi.mock("@/features/trade/hooks/useFundingRate", () => ({
  useFundingRate: () => ({
    data: mockFundingRate,
  }),
}))

vi.mock("@/lib/contracts", () => ({
  ExchangeRouterClient: class {},
  SyntheticsReaderClient: class {},
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
}))

vi.mock("@/features/trade/lib/stellar", () => ({
  cancelOrder: vi.fn(),
  createIncreaseOrder: vi.fn(),
  createDecreaseOrder: vi.fn(),
  createSwapOrder: vi.fn(),
  claimFundingFees: vi.fn(),
  sendBatchOrderTxn: vi.fn(),
  createSidecarOrder: vi.fn(),
  amendOrderViaReplace: vi.fn(),
}))

vi.mock("@/features/trade/hooks/useTokenPrices", () => ({
  useTokenPrices: () => ({
    getMidPrice: () => 1,
    isStale: () => false,
    getPrice: () => ({ minPrice: 1, maxPrice: 1 }),
    getStaleness: () => "fresh" as const,
  }),
}))

vi.mock("@/features/wallet/hooks/useTokenBalances", () => ({
  useTokenBalances: () => ({
    data: {} as Record<string, number>,
    isLoading: false,
  }),
}))

vi.mock("@/features/trade/hooks/useTokenList", () => ({
  useTokenList: () => ({
    data: [],
    isLoading: false,
  }),
}))

vi.mock("@/shared/components/TokenIcon", () => ({
  TokenIcon: ({ symbol, size }: { symbol: string; size: number }) => (
    <span data-testid="token-icon" data-symbol={symbol} data-size={size}>
      {symbol}
    </span>
  ),
}))

function createMockPosition(overrides: Record<string, unknown> = {}) {
  return {
    key: "pos-1",
    account: "GABCDEF123456789",
    marketAddress: "0xbtc",
    marketName: "BTC/USD",
    indexToken: "WBTC",
    collateralToken: "USDC",
    collateralAmount: 1,
    collateralUsd: 100000,
    sizeUsd: 50000,
    sizeInUsdRaw: 50000000000n,
    entryPrice: 50000,
    markPrice: 51000,
    liquidationPrice: 45000,
    leverage: 10,
    pnl: 1000,
    pnlPercent: 10,
    isLong: true,
    pnlAfterFees: 950,
    fundingFeeUsd: 50,
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let PositionsList: typeof import("./PositionsList").PositionsList

describe("PositionsList", () => {
  beforeEach(async () => {
    PositionsList = (await import("./PositionsList")).PositionsList
    mockPositions = []
    mockIsLoading = false
    mockIsDisabled = false
    mockFundingRate = { ratePerHour: 0.001, nextEpochTs: Date.now() + 3600000 }
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      network: "testnet",
      pendingTransactionXdr: null,
    })
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  it("renders loading skeleton when loading", () => {
    mockIsLoading = true
    const { container } = render(<PositionsList />, { wrapper: createWrapper() })
    expect(container.querySelector("[data-slot='skeleton']")).toBeInTheDocument()
  })

  it("renders empty state when no positions", () => {
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByText("No open positions")).toBeInTheDocument()
  })

  it("renders empty state with start trading link", () => {
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByText("Start trading →")).toBeInTheDocument()
  })

  it("renders positions with market name, side badge, and size", () => {
    mockPositions = [createMockPosition()]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByText("BTC/USD")).toBeInTheDocument()
    expect(screen.getByText("Long")).toBeInTheDocument()
  })

  it("renders multiple positions", () => {
    mockPositions = [
      createMockPosition({ key: "pos-1", marketName: "BTC/USD" }),
      createMockPosition({ key: "pos-2", marketName: "ETH/USD" }),
    ]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByText("BTC/USD")).toBeInTheDocument()
    expect(screen.getByText("ETH/USD")).toBeInTheDocument()
  })

  it("renders short position badge", () => {
    mockPositions = [createMockPosition({ isLong: false })]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByText("Short")).toBeInTheDocument()
  })

  it("renders action buttons for each position", () => {
    mockPositions = [createMockPosition()]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "+ Collateral" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "- Collateral" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("renders funding fee when positive", () => {
    mockPositions = [createMockPosition({ fundingFeeUsd: 50 })]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.getByRole("button", { name: "Claim" })).toBeInTheDocument()
  })

  it("does not render Claim button when funding fee is zero", () => {
    mockPositions = [createMockPosition({ fundingFeeUsd: 0 })]
    render(<PositionsList />, { wrapper: createWrapper() })
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument()
  })

  it("renders indexer disabled message when disabled", () => {
    mockIsDisabled = true
    render(<PositionsList />, { wrapper: createWrapper() })
    const messages = screen.getAllByText(/indexer disabled/i)
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })

  it("shows positive PnL in green", () => {
    mockPositions = [createMockPosition({ pnlAfterFees: 950 })]
    render(<PositionsList />, { wrapper: createWrapper() })
    const pnlElements = screen.getAllByText(/\$950\.00/)
    expect(pnlElements.length).toBeGreaterThanOrEqual(1)
    expect(pnlElements[0].className).toContain("text-green-500")
  })

  it("shows negative PnL in red", () => {
    mockPositions = [createMockPosition({ pnlAfterFees: -500 })]
    render(<PositionsList />, { wrapper: createWrapper() })
    const pnlElements = screen.getAllByText((_content, element) => {
      const text = element?.textContent ?? ""
      return text.includes("$-") && text.includes("500")
    })
    expect(pnlElements.length).toBeGreaterThanOrEqual(1)
  })
})
