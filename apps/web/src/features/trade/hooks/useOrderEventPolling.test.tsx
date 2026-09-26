// OB-117: live updates must be safe across account and network switches —
// a delayed response for an old account/network must never touch the
// currently visible cache, and switching account or network must reset the
// subscription (fresh cursor, no stale invalidation).

import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { xdr } from "@stellar/stellar-sdk"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOrderEventPolling } from "./useOrderEventPolling"
import type { rpc} from "@stellar/stellar-sdk";
import type { ReactNode } from "react"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

import { sorobanRpc } from "@/lib/soroban/client"

vi.mock("@/lib/soroban/client", () => ({
  sorobanRpc: { getEvents: vi.fn() },
}))

vi.mock("@/app/config/contracts", () => ({
  CONTRACTS: { exchangeRouter: "CONTRACT_ID" },
}))

const ACCOUNT_A = "GACCOUNTA00000000000000000000000000000000000000000000000000"
const ACCOUNT_B = "GACCOUNTB00000000000000000000000000000000000000000000000000"

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
}

type TestOrderEvent = rpc.Api.EventResponse & {
  data: { event_name: string; account: string }
}

function orderEvent(
  account: string,
  eventName = "OrderExecuted",
): TestOrderEvent {
  return {
    id: `event-${account}-${eventName}`,
    type: "contract",
    ledger: 1,
    ledgerClosedAt: new Date(0).toISOString(),
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "deadbeef",
    topic: [],
    value: xdr.ScVal.scvVoid(),
    data: { event_name: eventName, account },
  }
}

function eventsResponse(
  events: Array<rpc.Api.EventResponse>,
  cursor = "",
): rpc.Api.GetEventsResponse {
  return {
    events,
    cursor,
    latestLedger: 1,
    latestLedgerCloseTime: new Date(0).toISOString(),
    oldestLedger: 1,
    oldestLedgerCloseTime: new Date(0).toISOString(),
  }
}

describe("useOrderEventPolling (OB-117)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    testQueryClient.clear()
    useWalletStore.setState({ address: null, network: "mainnet", status: "disconnected" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("discards an in-flight response for an account that has since been switched away from", async () => {
    let resolveFirstPoll!: (value: rpc.Api.GetEventsResponse) => void
    const getEvents = vi.mocked(sorobanRpc.getEvents)
    getEvents.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirstPoll = resolve }),
    )
    getEvents.mockResolvedValue(eventsResponse([]))

    useWalletStore.setState({ address: ACCOUNT_A, network: "mainnet", status: "connected" })
    const { rerender } = renderHook(() => useOrderEventPolling(), { wrapper })

    // Switch accounts while the first poll for ACCOUNT_A is still pending.
    act(() => {
      useWalletStore.setState({ address: ACCOUNT_B, network: "mainnet", status: "connected" })
    })
    rerender()

    // The delayed ACCOUNT_A response now arrives.
    await act(async () => {
      resolveFirstPoll(eventsResponse([orderEvent(ACCOUNT_A)], "cursor-a"))
      await Promise.resolve()
      await Promise.resolve()
    })

    // It must not have been able to schedule a follow-up poll under the
    // stale generation.
    expect(getEvents).toHaveBeenCalledTimes(2) // ACCOUNT_A's first call + ACCOUNT_B's first call
  });

  it("resets the polling cursor when the network changes, even with the same account", async () => {
    const getEvents = vi.mocked(sorobanRpc.getEvents)
    getEvents.mockResolvedValue(eventsResponse([orderEvent(ACCOUNT_A)], "cursor-1"))

    useWalletStore.setState({ address: ACCOUNT_A, network: "mainnet", status: "connected" })
    const { rerender } = renderHook(() => useOrderEventPolling(), { wrapper })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    getEvents.mockClear()

    act(() => {
      useWalletStore.setState({ address: ACCOUNT_A, network: "testnet", status: "connected" })
    })
    rerender()

    await act(async () => {
      await Promise.resolve()
    })

    // A fresh subscription for the new network must not carry over the
    // previous network's cursor.
    const callParams = getEvents.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(callParams?.cursor).toBeUndefined()
  })

  it("stops polling entirely once the account disconnects", async () => {
    const getEvents = vi.mocked(sorobanRpc.getEvents)
    getEvents.mockResolvedValue(eventsResponse([]))

    useWalletStore.setState({ address: ACCOUNT_A, network: "mainnet", status: "connected" })
    const { rerender } = renderHook(() => useOrderEventPolling(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      useWalletStore.setState({ address: null, network: "mainnet", status: "disconnected" })
    })
    rerender()

    getEvents.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(getEvents).not.toHaveBeenCalled()
  })
})
