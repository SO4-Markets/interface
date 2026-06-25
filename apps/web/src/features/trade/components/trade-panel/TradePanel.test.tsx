import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import type { TradePanel as TradePanelComponent } from "./TradePanel"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

vi.mock("@/lib/contracts", () => ({
  // ── Re-exported clients (from @workspace/contracts) ────────────────────
  ExchangeRouterClient: class {},
  GlvRouterClient: class {},
  OrderVaultClient: class {},
  ReferralStorageClient: class {},
  SacTokenClient: class {},
  StakingRouterClient: class {},
  SyntheticsReaderClient: class {},
  TokenClient: class {},
  VestingRouterClient: class {},
  // ── Instances created by contracts.ts ──────────────────────────────────
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
  referralStorageClient: {},
  orderVaultClient: {},
  sacTokenClient: {},
  stakingRouterClient: { getStakerInfo: vi.fn() },
  // ── Referral helpers ──────────────────────────────────────────────────
  referralPromptStorageKey: (a: string) => `referral-prompt:${a}`,
  affiliateCodeStorageKey: (a: string) => `affiliate-code:${a}`,
  getTraderReferralCode: vi.fn(() => ""),
  readStoredReferralCode: vi.fn(() => ""),
  // ── Contract tx builders ──────────────────────────────────────────────
  buildBatchOrderTransaction: vi.fn(),
  buildCreateOrderTransaction: vi.fn(),
  buildCancelOrderTransaction: vi.fn(),
  buildCreateDepositTransaction: vi.fn(),
  buildCreateWithdrawalTransaction: vi.fn(),
  buildClaimRebatesTransaction: vi.fn(),
  buildRegisterCodeTransaction: vi.fn(),
  buildSetTraderReferralCodeTransaction: vi.fn(),
  buildClaimFundingFeesTransaction: vi.fn(),
  buildStakeSO4Transaction: vi.fn(),
  buildUnstakeSO4Transaction: vi.fn(),
  buildClaimRewardsTransaction: vi.fn(),
  buildCompoundTransaction: vi.fn(),
  buildDepositForVestingTransaction: vi.fn(),
  buildApproveTransaction: vi.fn(),
  // ── Error helpers ─────────────────────────────────────────────────────
  mapContractError: vi.fn(),
  parseSorobanError: vi.fn((e: unknown) => String(e)),
  mapReferralContractError: vi.fn(),
  // ── Misc ──────────────────────────────────────────────────────────────
  checkAllowance: vi.fn(),
  getTokenClient: vi.fn(),
  getGlvRouterClient: vi.fn(),
  getStakingRouterClient: vi.fn(),
  getVestingRouterClient: vi.fn(),
  getTraderDiscountBps: vi.fn(),
  getReferralCodeStats: vi.fn(),
  getTraderRebateInfo: vi.fn(),
  getAffiliateCode: vi.fn(),
  saveReferralCode: vi.fn(),
  AFFILIATE_CODE_STORAGE_KEY: "so4-affiliate-code",
  REFERRAL_PROMPT_STORAGE_KEY: "so4-referral-prompt-done",
  REFERRAL_CODE_STORAGE_KEY: "so4-referral-code",
}))

vi.mock("../../hooks/useTokenPrices", () => ({
  useTokenPrices: () => ({
    getMidPrice: () => 1,
    isStale: () => false,
    getPrice: () => ({ minPrice: 1, maxPrice: 1 }),
    getStaleness: () => "fresh" as const,
  }),
}))

vi.mock("../../hooks/useTradeFees", () => ({
  useTradeFees: () => ({
    positionFeeUsd: 0,
    priceImpactUsd: 0,
    executionFeeUsd: 0,
    executionFeeXlm: 0,
    totalFeesUsd: 0,
    feesBreakdown: [],
  }),
}))

const mockBalances: { data: Record<string, number> | undefined } = { data: undefined }

vi.mock("../../../wallet/hooks/useTokenBalances", () => ({
  useTokenBalances: () => ({
    data: mockBalances.data,
    isLoading: false,
  }),
}))

function createMockTrade(overrides: Record<string, unknown> = {}) {
  return {
    tradeType: "Long" as const,
    tradeMode: "Market" as const,
    tradeFlags: {
      isLong: true,
      isShort: false,
      isSwap: false,
      isPosition: true,
      isMarket: true,
      isLimit: false,
      isTrigger: false,
    },
    fromAmount: "",
    leverage: 10,
    fromTokenAddress: "TUSDC",
    toTokenAddress: "TWBTC",
    marketAddress: "0xmarket",
    collateralAddress: "TUSDC",
    availableTradeModes: ["Market", "Limit", "Trigger"],
    advanced: { advancedDisplay: false, slippagePct: 0.3 },
    setTradeType: vi.fn(),
    setTradeMode: vi.fn(),
    setLeverage: vi.fn(),
    setTriggerPrice: vi.fn(),
    setFromAmount: vi.fn(),
    switchTokens: vi.fn(),
    setAdvanced: vi.fn(),
    setSlippagePct: vi.fn(),
    sidecarOrders: [],
    addSidecarOrder: vi.fn(),
    removeSidecarOrder: vi.fn(),
    clearSidecarOrders: vi.fn(),
    setActivePosition: vi.fn(),
    setFromTokenAddress: vi.fn(),
    setToTokenAddress: vi.fn(),
    setMarketAddress: vi.fn(),
    setCollateralAddress: vi.fn(),
    setToAmount: vi.fn(),
    ...overrides,
  }
}

let TradePanel: TradePanelComponent

describe("TradePanel", () => {
  beforeAll(async () => {
    TradePanel = (await import("./TradePanel")).TradePanel
  })

  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      network: "testnet",
      pendingTransactionXdr: null,
    })
  })

  it("renders side selector with Long, Short, and Swap tabs", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    expect(screen.getByRole("tab", { name: "Long" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Short" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Swap" })).toBeInTheDocument()
  })

  it("renders order mode buttons (Market, Limit, Trigger)", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    expect(screen.getByRole("button", { name: "Market" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Limit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trigger" })).toBeInTheDocument()
  })

  it("renders collateral input for position trades", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    expect(screen.getByText("Collateral")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument()
  })

  it("renders leverage slider with current value", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    expect(screen.getByText("Leverage")).toBeInTheDocument()
    expect(screen.getByText("10×")).toBeInTheDocument()
  })

  it("renders submit button with trade type and token label", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    const button = screen.getByRole("button", { name: /Long.*TWBTC/i })
    expect(button).toBeInTheDocument()
  })

  it("disables submit button when wallet is not connected", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    const button = screen.getByRole("button", { name: /Long/i })
    expect(button).toBeDisabled()
  })

  it("enables submit button when wallet connected with sufficient balance and amount entered", () => {
    useWalletStore.setState({
      address: "GABCDEF123456789",
      status: "connected",
    })
    mockBalances.data = { TUSDC: 10000, XLM: 100 }

    render(<TradePanel trade={createMockTrade({ fromAmount: "100" })} />, { wrapper: createWrapper() })

    const button = screen.getByRole("button", { name: /Long/i })
    expect(button).toBeEnabled()
  })

  it("shows Market label instead of Receive for position trades", () => {
    render(<TradePanel trade={createMockTrade()} />, { wrapper: createWrapper() })

    const marketLabels = screen.getAllByText("Market")
    expect(marketLabels.length).toBeGreaterThanOrEqual(2)
  })
})
