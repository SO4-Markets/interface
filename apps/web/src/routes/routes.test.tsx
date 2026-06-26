import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/ui/theme-provider"

// ── Shared mocks ────────────────────────────────────────────
// Navbar pulls in ConnectButton → @creit.tech/stellar-wallets-kit → crashes in test
vi.mock("@/ui/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}))

// NetworkMismatchBanner uses useNetwork → useWalletStore
vi.mock("@/features/wallet/components/NetworkMismatchBanner", () => ({
  NetworkMismatchBanner: () => null,
}))

// ConnectButton used directly in FaucetPage
vi.mock("@/features/wallet/components/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

// TokenIcon used in FaucetPage
vi.mock("@/shared/components/TokenIcon", () => ({
  TokenIcon: ({ symbol }: { symbol: string }) => (
    <span data-testid={`token-icon-${symbol}`} />
  ),
}))

// Link needs RouterProvider context — replace with plain <a> for smoke tests
// getRouteApi needs RouterProvider context — return a shim
// createFileRoute/createRootRoute must produce usable route objects
vi.mock("@tanstack/react-router", () => {
  function createFileRoute(_path: string) {
    return (opts: Record<string, unknown>) => opts as { component: React.ComponentType }
  }
  function createRootRoute(opts?: Record<string, unknown>) {
    return (opts ?? {}) as Record<string, unknown>
  }
  return {
    createFileRoute,
    createRootRoute,
    Link: ({ children, to, ...props }: Record<string, unknown>) => (
      <a href={to as string} {...props}>
        {children as React.ReactNode}
      </a>
    ),
    getRouteApi: () => ({
      useSearch: () => ({}),
      useMatch: () => ({}),
      useLoaderData: () => ({}),
      useParams: () => ({}),
    }),
  }
})

// ── Trade-page mocks ────────────────────────────────────────
vi.mock("@/features/trade/hooks/useTradeState", () => ({
  useTradeState: () => ({
    tradeType: "Long",
    tradeMode: "Market",
    tradeFlags: {
      isLong: true, isShort: false, isSwap: false,
      isPosition: true, isMarket: true, isLimit: false, isTrigger: false,
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
  }),
}))

vi.mock("@/features/trade/hooks/useOrderEventPolling", () => ({
  useOrderEventPolling: () => {},
}))

vi.mock("@/features/trade/components/chart/TVChart", () => ({
  TVChart: () => <div data-testid="tv-chart" />,
}))

vi.mock("@/features/trade/components/trade-panel/TradePanel", () => ({
  TradePanel: () => <div data-testid="trade-panel" />,
}))

vi.mock("@/features/trade/components/positions/BottomTabs", () => ({
  BottomTabs: () => <div data-testid="bottom-tabs" />,
}))

vi.mock("@/features/trade/components/CircuitBreakerBanner", () => ({
  CircuitBreakerBanner: () => null,
}))

vi.mock("@/lib/contracts", () => ({
  saveReferralCode: vi.fn(),
  referralStorageClient: { getStakerInfo: vi.fn() },
  getAffiliateCode: vi.fn(),
  getTraderDiscountBps: vi.fn(),
  getTraderReferralCode: vi.fn(),
}))

// ── Faucet-page mocks ───────────────────────────────────────
vi.mock("@/features/faucet/hooks/useFaucetData", () => ({
  useFaucetData: () => ({ data: undefined, isLoading: false }),
}))

vi.mock("@/features/faucet/hooks/useClaim", () => ({
  useClaim: () => ({
    claimOne: vi.fn(),
    claimAll: vi.fn(),
    pendingTokens: new Set<string>(),
    isBulkPending: false,
  }),
}))

vi.mock("@/features/faucet/data/tokens", () => ({
  FAUCET_TOKENS: [
    { symbol: "TUSDC", name: "Test USDC", contractId: "CUSDC0001", decimals: 7 },
    { symbol: "TWBTC", name: "Test WBTC", contractId: "CWBTC0002", decimals: 7 },
    { symbol: "TETH", name: "Test Ether", contractId: "CETH0003", decimals: 7 },
    { symbol: "TXLM", name: "Test Stellar Lumens", contractId: "CTXLM0004", decimals: 7 },
  ],
  FAUCET_CONTRACT_ID: "CFAUCET001",
}))

// ── Earn-page sub-tab mocks ─────────────────────────────────
vi.mock("@/features/earn/components/portfolio/portfolio-tab", () => ({
  PortfolioTab: () => null,
}))
vi.mock("@/features/earn/components/discover/discover-tab", () => ({
  DiscoverTab: () => null,
}))
vi.mock("@/features/earn/components/additional/additional-opportunities-tab", () => ({
  AdditionalOpportunitiesTab: () => null,
}))
vi.mock("@/features/earn/components/distributions/distributions-tab", () => ({
  DistributionsTab: () => null,
}))

// ── Referrals-page mocks ────────────────────────────────────
vi.mock("@/features/referrals/components/traders/traders-tab", () => ({
  TradersTab: () => null,
}))
vi.mock("@/features/referrals/components/affiliates/affiliates-tab", () => ({
  AffiliatesTab: () => null,
}))
vi.mock("@/features/referrals/components/distributions/distributions-tab", () => ({
  DistributionsTab: () => null,
}))
vi.mock("@/features/referrals/components/referrals-sidebar", () => ({
  ReferralsSidebar: () => null,
}))
vi.mock("@/features/referrals/hooks/use-referrals-data", () => ({
  useTraderStats: () => ({ data: undefined }),
  useAffiliateStats: () => ({ data: undefined }),
  useAffiliateReferrals: () => ({ data: undefined }),
  useDistributions: () => ({ data: undefined }),
}))

vi.mock("@/features/referrals/queries/useReferralCode", () => ({
  useReferralCode: () => ({ data: null }),
}))

vi.mock("@/features/referrals/queries/useReferralTier", () => ({
  useReferralTier: () => ({ data: undefined }),
}))

vi.mock("@/features/referrals/queries/useReferralStats", () => ({
  useReferralStats: () => ({ data: undefined }),
}))



// ── Helpers ─────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    )
  }
}

// ── Tests ───────────────────────────────────────────────────

describe("route smoke tests", () => {
  afterEach(cleanup)

  describe("/", () => {
    it("renders the landing page without crashing", async () => {
      const { Route } = await import("./index")
      render(<Route.component />, { wrapper: createWrapper() })
      await waitFor(() => {
        expect(screen.getByTestId("navbar")).toBeInTheDocument()
      })
    })
  })

  describe("/trade", () => {
    it("renders the trade page without crashing", async () => {
      const { Route } = await import("./trade")
      render(<Route.component />, { wrapper: createWrapper() })
      await waitFor(() => {
        expect(screen.getByTestId("navbar")).toBeInTheDocument()
      })
    })
  })

  describe("/pools", () => {
    it("renders the pools page with a stable heading", async () => {
      const { Route } = await import("./pools")
      render(<Route.component />, { wrapper: createWrapper() })
      await screen.findByRole("heading", { name: /^pools$/i, level: 1 })
    })
  })

  describe("/earn", () => {
    it("renders the earn page with a stable heading", async () => {
      const { Route } = await import("./earn")
      render(<Route.component />, { wrapper: createWrapper() })
      await screen.findByRole("heading", { name: /earn/i })
    })
  })

  describe("/faucet", () => {
    it("renders the faucet page with a stable heading", async () => {
      const { Route } = await import("./faucet")
      render(<Route.component />, { wrapper: createWrapper() })
      await screen.findByRole("heading", { name: /testnet faucet/i })
    })
  })

  describe("/referrals", () => {
    it("renders the referrals page with a stable heading", async () => {
      const { Route } = await import("./referrals")
      render(<Route.component />, { wrapper: createWrapper() })
      await screen.findByRole("heading", { name: /referrals/i })
    })
  })
})
