import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { xdr } from "@stellar/stellar-sdk/minimal"
import { useOrderEventPolling } from "./useOrderEventPolling"
import type { ContractEvent } from "@/lib/soroban/events"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

const getEvents = vi.fn()

vi.mock("@/lib/soroban/client", () => ({
  sorobanRpc: { getEvents: (...args: Array<unknown>) => getEvents(...args) },
}))

const ACCOUNT = "GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ"
const OTHER = "GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34"

function event(id: string, name: string, account = ACCOUNT): ContractEvent {
  return {
    id,
    type: "contract",
    ledger: 100,
    ledgerClosedAt: "2026-11-24T00:00:00Z",
    txHash: `0x${id}`,
    contractId: "CAAA",
    topics: [xdr.ScVal.scvSymbol(name), xdr.ScVal.scvString(account)],
    value: xdr.ScVal.scvVoid(),
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useOrderEventPolling account event callback (issue 956)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getEvents.mockReset()
    useWalletStore.setState({ address: ACCOUNT, network: "testnet" })
  })

  afterEach(() => {
    vi.useRealTimers()
    useWalletStore.setState({ address: null })
  })

  it("reports new fills for the account but not history replayed on connect", async () => {
    getEvents
      // First poll: backlog from before the page opened.
      .mockResolvedValueOnce({ events: [event("old", "OrderExecuted")], cursor: "c1" })
      // Second poll: live events.
      .mockResolvedValueOnce({
        events: [
          event("fill", "OrderExecuted"),
          event("someone-else", "OrderExecuted", OTHER),
          event("created", "OrderCreated"),
        ],
        cursor: "c2",
      })
      .mockResolvedValue({ events: [], cursor: "c2" })

    const onAccountEvent = vi.fn()
    renderHook(() => useOrderEventPolling({ onAccountEvent }), { wrapper })

    await vi.advanceTimersByTimeAsync(0)
    expect(getEvents).toHaveBeenCalledTimes(1)
    expect(onAccountEvent).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(getEvents).toHaveBeenCalledTimes(2)
    expect(onAccountEvent.mock.calls).toEqual([["OrderExecuted"], ["OrderCreated"]])
  })

  it("keeps treating events as history while the backlog is still draining", async () => {
    const fullPage = (prefix: string) =>
      Array.from({ length: 50 }, (_, i) => event(`${prefix}-${i}`, "OrderExecuted"))
    let page = 0
    getEvents.mockImplementation(() =>
      Promise.resolve(
        page < 11
          ? { events: fullPage(`p${page}`), cursor: `c${++page}` }
          : { events: [], cursor: `c${page}` },
      ),
    )

    const onAccountEvent = vi.fn()
    renderHook(() => useOrderEventPolling({ onAccountEvent }), { wrapper })

    // First poll stops at the 10-page cap without reaching the head.
    await vi.advanceTimersByTimeAsync(0)
    // Second poll drains the last backlog page.
    await vi.advanceTimersByTimeAsync(5000)
    expect(onAccountEvent).not.toHaveBeenCalled()
  })
})
