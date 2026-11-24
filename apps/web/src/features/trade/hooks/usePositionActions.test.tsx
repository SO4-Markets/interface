import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Position } from "./usePositions"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

const mockCreateDecreaseOrder = vi.fn()
const mockCreateIncreaseOrder = vi.fn()
const mockGetAccountPositions = vi.fn()

vi.mock("../lib/stellar", () => ({
  createDecreaseOrder: (...args: Array<unknown>) => mockCreateDecreaseOrder(...args),
  createIncreaseOrder: (...args: Array<unknown>) => mockCreateIncreaseOrder(...args),
}))

vi.mock("@/lib/contracts", () => ({
  syntheticsReaderClient: {
    getAccountPositions: (...args: Array<unknown>) => mockGetAccountPositions(...args),
  },
}))

vi.mock("@/features/wallet/hooks/useTokenBalances", () => ({
  useTokenBalances: () => ({ data: { USDC: 10_000 } }),
}))

const { usePositionActions } = await import("./usePositionActions")

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createPosition(overrides: Partial<Position> = {}): Position {
  return {
    key: "GABC-0xbtc-USDC-true",
    account: "GABC",
    marketAddress: "0xbtc",
    marketName: "BTC/USD",
    indexToken: "WBTC",
    collateralToken: "USDC",
    collateralAmount: 5_000,
    collateralUsd: 5_000,
    sizeUsd: 50_000,
    sizeInUsdRaw: 50_000_000_000_000_000_000_000_000_000_000_000n,
    entryPrice: 50_000,
    markPrice: 51_000,
    liquidationPrice: 45_000,
    leverage: 10,
    pnl: 1_000,
    pnlPercent: 20,
    isLong: true,
    pnlAfterFees: 950,
    fundingFeeUsd: 50,
    ...overrides,
  }
}

describe("usePositionActions transaction states (#1081)", () => {
  beforeEach(() => {
    mockCreateDecreaseOrder.mockReset()
    mockCreateIncreaseOrder.mockReset()
    mockGetAccountPositions.mockReset()
    mockGetAccountPositions.mockRejectedValue(new Error("use display fallback"))
    useWalletStore.setState({
      address: "GABC",
      walletId: "freighter",
      status: "connected",
      network: "testnet",
      pendingTransactionXdr: null,
    })
  })

  afterEach(() => {
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
    })
  })

  it("preserves exact raw size for partial close and tracks pending -> success", async () => {
    let resolveTx!: (hash: string) => void
    mockCreateDecreaseOrder.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTx = resolve
        }),
    )

    const position = createPosition()
    const { result } = renderHook(() => usePositionActions(), {
      wrapper: createWrapper(),
    })

    let submitPromise!: Promise<string | null>
    await act(async () => {
      submitPromise = result.current.submitClose(position, {
        isFull: false,
        sizeDeltaUsd: 12_500,
      })
    })

    expect(result.current.isBusy(position.key)).toBe(true)
    expect(result.current.getAction(position.key)?.status).toBe("pending")

    await act(async () => {
      resolveTx("txhash123")
      await submitPromise
    })

    expect(result.current.isBusy(position.key)).toBe(false)
    expect(result.current.getAction(position.key)).toMatchObject({
      kind: "close",
      status: "success",
      txHash: "txhash123",
    })

    expect(mockCreateDecreaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        sizeDeltaUsd: 12_500,
        sizeDeltaUsdRaw: position.sizeInUsdRaw / 4n,
        orderType: "MarketDecrease",
      }),
    )
  })

  it("records wallet rejection clearly without reporting a contract error or success", async () => {
    mockCreateDecreaseOrder.mockRejectedValue(new Error("User declined access"))

    const position = createPosition()
    const { result } = renderHook(() => usePositionActions(), {
      wrapper: createWrapper(),
    })

    let hash: string | null = "unexpected"
    await act(async () => {
      hash = await result.current.submitClose(position, {
        isFull: true,
        sizeDeltaUsd: 50_000,
      })
    })

    expect(hash).toBeNull()
    expect(result.current.isBusy(position.key)).toBe(false)
    expect(result.current.getAction(position.key)).toMatchObject({
      kind: "close",
      status: "error",
      txHash: null,
      errorMessage: "Transaction rejected in your wallet. No changes were made.",
    })
  })
})
