import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/ui/theme-provider"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

// ── Shared mocks ────────────────────────────────────────────
vi.mock("@/ui/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}))

vi.mock("@/features/wallet/components/NetworkMismatchBanner", () => ({
  NetworkMismatchBanner: () => null,
}))

vi.mock("@/features/wallet/components/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

// Referrals lib — must not reach real Soroban contracts
vi.mock("../lib/referrals", () => ({
  validateReferralCode: vi.fn(() => null),
  setTraderReferralCode: vi.fn(),
  createAffiliateCode: vi.fn(),
  claimRebates: vi.fn(),
  claimDistribution: vi.fn(),
}))

// All data hooks return empty state
vi.mock("../hooks/use-referrals-data", () => ({
  useTraderStats: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
  useAffiliateStats: () => ({ data: undefined }),
  useAffiliateReferrals: () => ({ data: [], isLoading: false }),
  useDistributions: () => ({ data: [], isLoading: false }),
}))

vi.mock("../queries/useReferralCode", () => ({
  useReferralCode: () => ({ data: null, isLoading: false }),
}))

vi.mock("../queries/useReferralTier", () => ({
  useReferralTier: () => ({ data: undefined }),
}))

vi.mock("../queries/useReferralStats", () => ({
  useReferralStats: () => ({ data: undefined, isLoading: false }),
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

describe("ReferralsPage", () => {
  beforeEach(() => {
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
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      network: "testnet",
      pendingTransactionXdr: null,
    })
  })

  describe("disconnected wallet", () => {
    it("renders the page heading", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(
        screen.getByRole("heading", { name: /referrals/i }),
      ).toBeInTheDocument()
    })

    it("renders the sidebar with 'No referral code active'", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(screen.getByText("No referral code active")).toBeInTheDocument()
    })

    it("shows the JoinCodeForm with Apply button disabled when wallet is disconnected", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(
        screen.getByText("Enter a referral code to receive a fee discount"),
      ).toBeInTheDocument()
      const applyButton = screen.getByRole("button", { name: /apply/i })
      expect(applyButton).toBeDisabled()
    })

    it("switches to Affiliates tab and shows CreateCodeForm", async () => {
      const user = userEvent.setup()
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      await user.click(screen.getByRole("tab", { name: /affiliates/i }))
      await waitFor(() => {
        expect(
          screen.getByText("Create a code and start earning commissions"),
        ).toBeInTheDocument()
      })
    })

    it("keeps the Distributions tab disabled (locked icon)", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      const distributionsTab = screen.getByRole("tab", { name: /distributions/i })
      expect(distributionsTab).toHaveAttribute("aria-disabled", "true")
    })

    it("renders all three tab triggers", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(screen.getByRole("tab", { name: /traders/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /affiliates/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /distributions/i })).toBeInTheDocument()
    })
  })

  describe("connected wallet, no referral activity", () => {
    beforeEach(() => {
      useWalletStore.setState({
        address: "GABCDEF123456789012345678901234567890123456789012345678901234",
        walletId: "freighter",
        status: "connected",
        network: "testnet",
        pendingTransactionXdr: null,
      })
    })

    it("enables the Apply button when a code is typed into JoinCodeForm", async () => {
      const user = userEvent.setup()
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      const input = screen.getByLabelText(/referral code/i)
      await user.type(input, "TESTCODE")
      const applyButton = screen.getByRole("button", { name: /apply/i })
      expect(applyButton).toBeEnabled()
    })

    it("shows Overview with $0.00 placeholder stats", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      await waitFor(() => {
        const zeroValues = screen.getAllByText("$0.00")
        expect(zeroValues.length).toBeGreaterThanOrEqual(1)
      })
    })

    it("still shows 'No referral code active' in the sidebar", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(screen.getByText("No referral code active")).toBeInTheDocument()
    })
  })

  describe("sidebar", () => {
    it("renders quick-link items", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(screen.getByText("How it works")).toBeInTheDocument()
      expect(screen.getByText("Claiming rewards")).toBeInTheDocument()
      expect(screen.getByText("Tiers")).toBeInTheDocument()
      expect(
        screen.getByText("Transferring a referral code"),
      ).toBeInTheDocument()
    })

    it("renders FAQ accordion for the trader view", async () => {
      const { ReferralsPage } = await import("./referrals-page")
      render(<ReferralsPage />, { wrapper: createWrapper() })
      expect(
        screen.getByText("How is my fee discount applied?"),
      ).toBeInTheDocument()
    })
  })
})
