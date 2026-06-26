import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

// ── Contract mock ─────────────────────────────────────────────────────────────

const mockGetMarketPoolAmounts = vi.fn()

vi.mock("@/lib/contracts", () => ({
  syntheticsReaderClient: {
    getMarketPoolAmounts: mockGetMarketPoolAmounts,
  },
  // stubs for other re-exports consumed transitively
  exchangeRouterClient: {},
  referralStorageClient: {},
  orderVaultClient: {},
  sacTokenClient: {},
  stakingRouterClient: {},
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

beforeEach(() => {
  mockGetMarketPoolAmounts.mockReset()
  useWalletStore.setState({
    address: null,
    walletId: null,
    status: "disconnected",
    network: "testnet",
    pendingTransactionXdr: null,
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useGLVVaultData (#236)", () => {
  it("returns zero defaults for an unknown vault address", async () => {
    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData("glv-unknown-vault"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      apr: 0,
      tvlUsd: 0,
      underlyingPoolAllocations: [],
      userGlvBalance: 0n,
    })
  })

  it("returns vault data for a known vault address (success path)", async () => {
    mockGetMarketPoolAmounts.mockResolvedValue({ poolValueUsd: 0 })

    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData("glv-btc-usdc"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.apr).toBeGreaterThan(0)
    expect(result.current.data?.tvlUsd).toBeGreaterThan(0)
    expect(Array.isArray(result.current.data?.underlyingPoolAllocations)).toBe(true)
  })

  it("falls back to static TVL when RPC call throws (error path)", async () => {
    mockGetMarketPoolAmounts.mockRejectedValue(new Error("RPC error"))

    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData("glv-btc-usdc"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.tvlUsd).toBeGreaterThan(0)
    expect(Array.isArray(result.current.data?.underlyingPoolAllocations)).toBe(true)
  })

  it("returns non-zero userGlvBalance when wallet is connected", async () => {
    mockGetMarketPoolAmounts.mockResolvedValue({ poolValueUsd: 0 })

    useWalletStore.setState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })

    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData("glv-btc-usdc"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.userGlvBalance).toBeGreaterThan(0n)
  })

  it("returns zero userGlvBalance when wallet is disconnected", async () => {
    mockGetMarketPoolAmounts.mockResolvedValue({ poolValueUsd: 0 })

    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData("glv-btc-usdc"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.userGlvBalance).toBe(0n)
  })

  it("does not run query when glvAddress is empty", async () => {
    const { useGLVVaultData } = await import("./useGLVVaultData")

    const { result } = renderHook(() => useGLVVaultData(""), {
      wrapper: createWrapper(),
    })

    // Query should be disabled — stays in pending/idle state
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})
