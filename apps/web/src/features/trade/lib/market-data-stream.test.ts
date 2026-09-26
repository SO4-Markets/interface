import { beforeEach, describe, expect, it, vi } from "vitest"
import { marketSubscriptionManager } from "./market-data-stream"

describe("Shared Market Data Subscription Lifecycle (OB-111)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shares the same subscription instance for the same symbol across multiple consumers", () => {
    const symbol = "XLM"
    const sub1 = marketSubscriptionManager.getOrCreate(symbol)
    const sub2 = marketSubscriptionManager.getOrCreate(symbol)

    expect(sub1).toBe(sub2)
    expect(marketSubscriptionManager.getActiveSourceCount()).toBe(1)
  })

  it("reference-counts consumers and does not multiply connection resources", () => {
    const symbol = "BTC"
    const shared = marketSubscriptionManager.getOrCreate(symbol)

    const cb1 = vi.fn()
    const cb2 = vi.fn()

    const unsub1 = shared.subscribeBook(cb1)
    expect(shared.totalConsumers()).toBe(1)

    const unsub2 = shared.subscribeTrades(cb2)
    expect(shared.totalConsumers()).toBe(2)

    // Unmounting one panel decrements consumer count without destroying shared instance
    unsub1()
    expect(shared.totalConsumers()).toBe(1)

    // Unmounting final panel tears down
    unsub2()
    expect(shared.totalConsumers()).toBe(0)
  })

  it("creates separate shared instances per active symbol and tears down when unsubscribed", () => {
    const subXlm = marketSubscriptionManager.getOrCreate("XLM")
    const subEth = marketSubscriptionManager.getOrCreate("ETH")

    expect(subXlm).not.toBe(subEth)
    expect(marketSubscriptionManager.getActiveSourceCount()).toBe(2)

    subXlm.destroy()
    expect(marketSubscriptionManager.getActiveSourceCount()).toBe(1)

    subEth.destroy()
    expect(marketSubscriptionManager.getActiveSourceCount()).toBe(0)
  })
})
