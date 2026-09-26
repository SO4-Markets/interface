import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QUERY_POLICY_TABLE, queryPolicy } from "./query-policies"

afterEach(() => {
  vi.useRealTimers()
})

describe("query data-class policies", () => {
  it("keeps freshness separate from retention", () => {
    for (const policy of Object.values(QUERY_POLICY_TABLE)) {
      expect(policy.staleTime).not.toBe(Infinity)
      expect(Number(policy.gcTime)).toBeGreaterThan(Number(policy.staleTime))
    }
  })

  it("does not poll when streaming or hidden", () => {
    expect(
      queryPolicy("prices-depth", {
        visible: true,
        streaming: false,
        fallbackPollMs: 1_000,
      }).refetchInterval,
    ).toBe(1_000)

    expect(
      queryPolicy("prices-depth", {
        visible: true,
        streaming: true,
        fallbackPollMs: 1_000,
      }).refetchInterval,
    ).toBe(false)

    expect(
      queryPolicy("prices-depth", {
        visible: false,
        streaming: false,
        fallbackPollMs: 1_000,
      }).refetchInterval,
    ).toBe(false)
  })

  it("polls while active, stops while unmounted, and revalidates on remount", async () => {
    vi.useFakeTimers()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let requests = 0
    const options = {
      queryKey: ["policy", "prices"] as const,
      queryFn: async () => ++requests,
      ...queryPolicy("prices-depth", {
        visible: true,
        streaming: false,
        fallbackPollMs: 1_000,
      }),
    }

    const first = new QueryObserver(client, options)
    const unsubscribe = first.subscribe(() => undefined)
    await vi.advanceTimersByTimeAsync(0)
    expect(requests).toBe(1)

    await vi.advanceTimersByTimeAsync(3_100)
    expect(requests).toBeGreaterThanOrEqual(4)

    unsubscribe()
    const stoppedAt = requests
    await vi.advanceTimersByTimeAsync(4_000)
    expect(requests).toBe(stoppedAt)

    const remount = new QueryObserver(client, options)
    const unsubscribeRemount = remount.subscribe(() => undefined)
    await vi.advanceTimersByTimeAsync(0)
    expect(requests).toBe(stoppedAt + 1)

    unsubscribeRemount()
    client.clear()
  })
})
