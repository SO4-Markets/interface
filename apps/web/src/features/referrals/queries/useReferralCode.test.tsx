import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useReferralCode } from "./useReferralCode"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetReferralInfo = vi.fn()
const mockReadStoredAffiliateCode = vi.fn()

vi.mock("@/lib/contracts", () => ({
  referralStorageClient: {
    getReferralInfo: mockGetReferralInfo,
  },
  affiliateCodeStorageKey: (addr: string) => `affiliate-code:${addr}`,
  // stubs consumed transitively
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
  orderVaultClient: {},
  sacTokenClient: {},
  stakingRouterClient: {},
}))

vi.mock("../lib/referrals", () => ({
  readStoredAffiliateCode: mockReadStoredAffiliateCode,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function TestComponent() {
  const { data, isLoading, isError } = useReferralCode()

  if (isLoading) return <div data-testid="loading">Loading…</div>
  if (isError) return <div data-testid="error">Error loading referral code</div>
  if (!data) return <div data-testid="empty">No referral code</div>
  return <div data-testid="code">{data}</div>
}

beforeEach(() => {
  mockGetReferralInfo.mockReset()
  mockReadStoredAffiliateCode.mockReset()
  useWalletStore.setState({
    address: null,
    walletId: null,
    status: "disconnected",
    network: "testnet",
    pendingTransactionXdr: null,
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useReferralCode (#237)", () => {
  it("does not fetch when wallet is disconnected — no loading or error shown", () => {
    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    // Query disabled — no loading/error states, falls to empty
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    expect(screen.queryByTestId("error")).not.toBeInTheDocument()
  })

  it("returns stored affiliate code from local storage (success path)", async () => {
    mockReadStoredAffiliateCode.mockReturnValue("MYCODE")

    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    await waitFor(() => expect(screen.getByTestId("code")).toBeInTheDocument())
    expect(screen.getByTestId("code")).toHaveTextContent("MYCODE")
  })

  it("falls back to on-chain lookup when no stored code exists (success path)", async () => {
    mockReadStoredAffiliateCode.mockReturnValue(null)
    mockGetReferralInfo.mockResolvedValue({ code: "ONCHAIN" })

    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    await waitFor(() => expect(screen.getByTestId("code")).toBeInTheDocument())
    expect(screen.getByTestId("code")).toHaveTextContent("ONCHAIN")
  })

  it("shows empty state when no stored code and on-chain returns null (not found)", async () => {
    mockReadStoredAffiliateCode.mockReturnValue(null)
    mockGetReferralInfo.mockResolvedValue({ code: null })

    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    await waitFor(() => expect(screen.getByTestId("empty")).toBeInTheDocument())
  })

  it("shows error state when on-chain lookup throws (RPC error)", async () => {
    mockReadStoredAffiliateCode.mockReturnValue(null)
    mockGetReferralInfo.mockRejectedValue(new Error("RPC error"))

    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    await waitFor(() => expect(screen.getByTestId("error")).toBeInTheDocument())
  })

  it("query key includes wallet address", async () => {
    mockReadStoredAffiliateCode.mockReturnValue(null)
    mockGetReferralInfo.mockResolvedValue({ code: "ADDR_SCOPED" })

    const addr1 = "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345"
    const addr2 = "GABCDEFGHIJKLMNOPQRSTUVWXYZ054321"

    useWalletStore.setState({
      address: addr1,
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const Wrapper = createWrapper()
    render(<Wrapper><TestComponent /></Wrapper>)

    await waitFor(() => expect(screen.getByTestId("code")).toBeInTheDocument())

    // The hook was called with the correct address
    expect(mockGetReferralInfo).toHaveBeenCalledWith(addr1)
    expect(mockGetReferralInfo).not.toHaveBeenCalledWith(addr2)
  })
})
