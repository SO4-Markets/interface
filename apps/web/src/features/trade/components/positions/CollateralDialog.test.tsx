import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

vi.mock("@/lib/contracts", () => ({
  ExchangeRouterClient: class {},
  SyntheticsReaderClient: class {},
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
  buildCreateOrderTransaction: vi.fn(),
  buildCancelOrderTransaction: vi.fn(),
}))

vi.mock("@/features/trade/hooks/useTokenPrices", () => ({
  useTokenPrices: () => ({
    getMidPrice: () => 1,
    isStale: () => false,
    getPrice: () => ({ minPrice: 1, maxPrice: 1 }),
    getStaleness: () => "fresh" as const,
  }),
}))

vi.mock("../../hooks/useMarketRiskParams", () => ({
  useMarketRiskParams: () => ({
    params: { maxLeverage: 50, maintenanceMarginRateBps: null, updatedAt: Date.now() },
    state: "available",
    isLoading: false,
    isError: false,
  }),
}))

const mockBalances: { data: Record<string, number> | undefined } = { data: undefined }

vi.mock("@/features/wallet/hooks/useTokenBalances", () => ({
  useTokenBalances: () => ({
    data: mockBalances.data,
    isLoading: false,
  }),
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
let CollateralDialog: typeof import("./CollateralDialog").CollateralDialog

describe("CollateralDialog", () => {
  beforeEach(async () => {
    CollateralDialog = (await import("./CollateralDialog")).CollateralDialog
    useWalletStore.setState({
      address: "GABCDEF123456789",
      walletId: null,
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })
    mockBalances.data = { USDC: 10000, XLM: 100 }
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  it("renders nothing when position is null", () => {
    const { container } = render(
      <CollateralDialog position={null} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when mode is null", () => {
    const position = createMockPosition()
    const { container } = render(
      <CollateralDialog position={position as any} mode={null} open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders add collateral dialog with correct title", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(screen.getByRole("heading", { name: /Add Collateral.*BTC/ })).toBeInTheDocument()
  })

  it("renders remove collateral dialog with correct title", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="remove" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(screen.getByRole("heading", { name: /Remove Collateral.*BTC/ })).toBeInTheDocument()
  })

  it("shows wallet balance in add mode", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(screen.getAllByText(/Wallet Balance/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("10,000 USDC")).toBeInTheDocument()
  })

  it("shows Use Max button in add mode", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(screen.getByText("Use Max")).toBeInTheDocument()
  })

  it("does not show Use Max button in remove mode", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="remove" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(screen.queryByText("Use Max")).not.toBeInTheDocument()
  })

  it("validates insufficient wallet balance in add mode", async () => {
    mockBalances.data = { USDC: 5, XLM: 100 }
    const position = createMockPosition()
    const user = userEvent.setup()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    const inputs = screen.getAllByPlaceholderText("0.00")
    const input = inputs[inputs.length - 1]
    await user.type(input, "10")
    expect(screen.getByText("Insufficient wallet balance")).toBeInTheDocument()
  })

  it("validates cannot remove all collateral in remove mode", async () => {
    const position = createMockPosition({ collateralAmount: 1 })
    const user = userEvent.setup()
    render(
      <CollateralDialog position={position as any} mode="remove" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    const inputs = screen.getAllByPlaceholderText("0.00")
    const input = inputs[inputs.length - 1]
    await user.type(input, "1")
    expect(screen.getByText(/Cannot remove all collateral/)).toBeInTheDocument()
  })

  it("disables confirm button when amount is empty", () => {
    const position = createMockPosition()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    const confirmButton = screen.getByRole("button", { name: /Confirm Add Collateral/ })
    expect(confirmButton).toBeDisabled()
  })

  it("enables confirm button with valid amount in add mode", async () => {
    mockBalances.data = { USDC: 10000, XLM: 100 }
    const position = createMockPosition()
    const user = userEvent.setup()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    )
    const inputs = screen.getAllByPlaceholderText("0.00")
    const input = inputs[inputs.length - 1]
    await user.type(input, "100")
    const confirmButton = screen.getByRole("button", { name: /Confirm Add Collateral/ })
    expect(confirmButton).toBeEnabled()
  })

  it("calls onClose when cancel is clicked", async () => {
    const position = createMockPosition()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <CollateralDialog position={position as any} mode="add" open={true} onClose={onClose} />,
      { wrapper: createWrapper() },
    )
    const cancelButton = screen.getByRole("button", { name: "Cancel" })
    await user.click(cancelButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
