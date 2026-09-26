import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

let mockData: Array<Record<string, unknown>> = []
let mockIsLoading = false
let mockIsDisabled = false

vi.mock("@/features/trade/hooks/useOrdersWithIndexer", () => ({
  useOrdersWithIndexer: () => ({
    data: mockData,
    isLoading: mockIsLoading,
    isDisabled: mockIsDisabled,
  }),
}))

vi.mock("@/lib/contracts", () => ({
  ExchangeRouterClient: class {},
  SyntheticsReaderClient: class {},
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
  buildCancelOrderTransaction: vi.fn(),
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

function createMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    key: "order-1",
    account: "GABCDEF123456789",
    marketAddress: "0xbtc",
    marketName: "BTC/USD",
    orderType: "MarketIncrease",
    status: "active",
    isLong: true,
    sizeUsd: 50000,
    triggerPrice: 0,
    updatedAt: Date.now(),
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let OrdersList: typeof import("./OrdersList").OrdersList

describe("OrdersList", () => {
  beforeEach(async () => {
    OrdersList = (await import("./OrdersList")).OrdersList
    mockData = []
    mockIsLoading = false
    mockIsDisabled = false
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  it("renders loading skeleton when loading", () => {
    mockIsLoading = true
    const { container } = render(<OrdersList />, { wrapper: createWrapper() })
    expect(container.querySelector("[data-slot='skeleton']")).toBeInTheDocument()
  })

  it("renders empty state when no orders", () => {
    render(<OrdersList />, { wrapper: createWrapper() })
    expect(screen.getByText("No open orders")).toBeInTheDocument()
  })

  it("renders empty state with indexer disabled message", () => {
    mockIsDisabled = true
    render(<OrdersList />, { wrapper: createWrapper() })
    const messages = screen.getAllByText(/indexer disabled/i)
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })

  it("renders active orders with market name and type", () => {
    mockData = [createMockOrder()]
    render(<OrdersList />, { wrapper: createWrapper() })
    expect(screen.getByText("BTC/USD")).toBeInTheDocument()
    expect(screen.getByText("Long")).toBeInTheDocument()
    expect(screen.getByText("MarketIncrease")).toBeInTheDocument()
  })

  it("renders multiple orders", () => {
    mockData = [
      createMockOrder({ key: "order-1", marketName: "BTC/USD" }),
      createMockOrder({ key: "order-2", marketName: "ETH/USD" }),
    ]
    render(<OrdersList />, { wrapper: createWrapper() })
    expect(screen.getByText("BTC/USD")).toBeInTheDocument()
    expect(screen.getByText("ETH/USD")).toBeInTheDocument()
  })

  it("renders frozen status badge", () => {
    mockData = [createMockOrder({ status: "frozen" })]
    render(<OrdersList />, { wrapper: createWrapper() })
    expect(screen.getByText("Frozen")).toBeInTheDocument()
  })

  it("renders cancel button for each order", () => {
    mockData = [
      createMockOrder({ key: "order-1" }),
      createMockOrder({ key: "order-2" }),
    ]
    render(<OrdersList />, { wrapper: createWrapper() })
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" })
    expect(cancelButtons).toHaveLength(2)
  })
})
