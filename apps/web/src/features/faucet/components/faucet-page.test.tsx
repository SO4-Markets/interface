import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

// ── Shared stub state for hooks ───────────────────────────────────────────────

const faucetDataStub = {
  data: undefined,
  isLoading: false,
}

const claimStub = {
  claimOne: vi.fn(),
  claimAll: vi.fn(),
  pendingTokens: new Set<string>(),
  isBulkPending: false,
}

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("../hooks/useFaucetData", () => ({
  useFaucetData: () => faucetDataStub,
}))

vi.mock("../hooks/useClaim", () => ({
  useClaim: () => claimStub,
}))

// Mock heavy UI pieces that pull in router / icon dependencies
vi.mock("@/ui/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}))

vi.mock("@/shared/components/TokenIcon", () => ({
  TokenIcon: ({ symbol }: { symbol: string }) => <span data-testid={`token-icon-${symbol}`} />,
}))

// Mock the ConnectButton to avoid wallet-kit side effects
vi.mock("@/features/wallet/components/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

// Mock FAUCET_TOKENS to keep tests lean
vi.mock("../data/tokens", () => ({
  FAUCET_TOKENS: [
    { symbol: "TUSDC", name: "Test USDC", contractId: "CUSDC0001" },
    { symbol: "TWBTC", name: "Test WBTC", contractId: "CWBTC0002" },
  ],
  FAUCET_CONTRACT_ID: "CFAUCET001",
}))

// Mock lib/clients to avoid real network calls
vi.mock("../lib/clients", () => ({
  FAUCET_CONTRACT_ID: "CFAUCET001",
  createFaucetClient: vi.fn(),
  createTokenClient: vi.fn(),
  fromContractAmount: vi.fn(() => 0),
}))

// ── Issue #219: faucet mainnet unavailable state ──────────────────────────────

describe("FaucetPage — mainnet unavailable state (#219)", () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })
  })

  it("shows the testnet-only message when network is mainnet", async () => {
    // Override the network module to simulate mainnet for this test only
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "mainnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/public/tx/${hash}`,
      explorerAccountUrl: (addr: string) => `https://stellar.expert/explorer/public/account/${addr}`,
    }))

    // Also mock useNetwork to report no mismatch (disconnected wallet)
    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: false, network: "testnet" }),
    }))

    // Also mock NetworkMismatchBanner so it doesn't pull in the real network module
    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => null,
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    expect(
      screen.getByText(/only available on the Stellar testnet/i),
    ).toBeInTheDocument()
  })

  it("does NOT show the testnet-only message when network is testnet", async () => {
    // Default vitest config sets VITE_NETWORK=testnet, so NETWORK.name === 'testnet'
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: false, network: "testnet" }),
    }))

    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => null,
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    expect(
      screen.queryByText(/only available on the Stellar testnet/i),
    ).not.toBeInTheDocument()
  })

  it("shows 'Connect your wallet' prompt when disconnected on testnet", async () => {
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: false, network: "testnet" }),
    }))

    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => null,
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    expect(
      screen.getByText(/Connect your wallet to claim test tokens/i),
    ).toBeInTheDocument()
  })
})

// ── Issue #218: faucet network mismatch disables claim ───────────────────────

describe("FaucetPage — network mismatch disables claim (#218)", () => {
  beforeEach(() => {
    // Wallet is connected to mainnet, but app runs on testnet → mismatch
    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      pendingTransactionXdr: null,
      network: "mainnet",
    })
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })
  })

  it("shows the mismatch inline warning when wallet network differs from app network", async () => {
    // App is testnet; wallet is mainnet → mismatch
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: true, network: "mainnet" }),
    }))

    // NetworkMismatchBanner needs mismatch + connected + non-root pathname
    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => (
        <div role="alert">
          Your wallet is connected to Mainnet but this app is running on Testnet. Please switch
          networks in your wallet.
        </div>
      ),
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    // The inline mismatch warning inside the claim panel
    expect(
      screen.getByText(/Switch your wallet to Stellar Testnet to claim/i),
    ).toBeInTheDocument()
  })

  it("shows mismatch banner (role=alert) when wallet network differs from app network", async () => {
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: true, network: "mainnet" }),
    }))

    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => (
        <div role="alert">
          Your wallet is connected to Mainnet but this app is running on Testnet. Please switch
          networks in your wallet.
        </div>
      ),
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    // Banner rendered by NetworkMismatchBanner mock
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("disables the Claim Test Tokens button when mismatch is true", async () => {
    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: true, network: "mainnet" }),
    }))

    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => (
        <div role="alert">Network mismatch</div>
      ),
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    // The bulk "Claim Test Tokens" button should be disabled when claimDisabled is true
    const claimButton = screen.getByRole("button", { name: /Claim Test Tokens/i })
    expect(claimButton).toBeDisabled()
  })

  it("enables the Claim Test Tokens button when connected with no mismatch", async () => {
    // Reset store to testnet to eliminate mismatch
    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      pendingTransactionXdr: null,
      network: "testnet",
    })

    vi.doMock("@/app/config/network", () => ({
      NETWORK: { name: "testnet" },
      explorerTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
      explorerAccountUrl: (addr: string) =>
        `https://stellar.expert/explorer/testnet/account/${addr}`,
    }))

    vi.doMock("@/features/wallet/hooks/useNetwork", () => ({
      useNetwork: () => ({ mismatch: false, network: "testnet" }),
    }))

    vi.doMock("@/features/wallet/components/NetworkMismatchBanner", () => ({
      NetworkMismatchBanner: () => null,
    }))

    const { FaucetPage } = await vi.importActual<{ FaucetPage: React.ComponentType }>(
      "../components/faucet-page",
    )

    render(<FaucetPage />)

    const claimButton = screen.getByRole("button", { name: /Claim Test Tokens/i })
    expect(claimButton).not.toBeDisabled()
  })
})
