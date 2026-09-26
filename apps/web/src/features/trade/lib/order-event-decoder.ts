import { scValToNative } from "@stellar/stellar-sdk"
import type { QueryClient } from "@tanstack/react-query"
import type { ContractEvent } from "@/lib/soroban/events"
import { queryKeys } from "./query-keys"

export type OrderEventType =
  | "OrderCreated"
  | "OrderExecuted"
  | "OrderCancelled"
  | "OrderUpdated"

export type DecodedOrderEvent = {
  id: string
  name: OrderEventType
  account: string | null
  orderId?: string | null
}

const KNOWN_ORDER_EVENTS = new Set([
  "ordercreated",
  "orderexecuted",
  "ordercancelled",
  "orderupdated",
])

function extractEventName(event: ContractEvent): OrderEventType | null {
  if (!event.topics || event.topics.length === 0) return null

  try {
    const raw = scValToNative(event.topics[0])
    const name = String(raw ?? "").toLowerCase()

    if (name === "ordercreated") return "OrderCreated"
    if (name === "orderexecuted") return "OrderExecuted"
    if (name === "ordercancelled") return "OrderCancelled"
    if (name === "orderupdated") return "OrderUpdated"
  } catch {
    return null
  }

  return null
}

function extractAccount(event: ContractEvent): string | null {
  // 1. Check topic[1] (indexed account address)
  if (event.topics && event.topics.length > 1) {
    try {
      const topic1 = scValToNative(event.topics[1])
      if (typeof topic1 === "string" && (topic1.startsWith("G") || topic1.startsWith("C"))) {
        return topic1
      }
    } catch {}
  }

  // 2. Check value payload (record fields)
  if (event.value) {
    try {
      const val = scValToNative(event.value)
      if (val && typeof val === "object") {
        const record = val as Record<string, unknown>
        const candidate = record.account ?? record.receiver ?? record.user ?? record.trader
        if (typeof candidate === "string") return candidate
      }
    } catch {}
  }

  return null
}

export function decodeOrderEvent(event: ContractEvent): DecodedOrderEvent | null {
  if (!event || !event.id) return null

  const name = extractEventName(event)
  if (!name) return null

  const account = extractAccount(event)

  return {
    id: event.id,
    name,
    account,
  }
}

/**
 * Applies the targeted query invalidation matrix based on the typed event.
 */
export async function applyOrderEventRefreshMatrix(
  queryClient: QueryClient,
  eventName: OrderEventType,
  chainId: string,
  account: string,
): Promise<void> {
  const tasks: Array<Promise<void>> = []

  switch (eventName) {
    case "OrderExecuted":
      // Execution / Fill affects positions, orders, token balances, and market stats
      tasks.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.positions(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.positionsFresh(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.tokenBalances(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.marketsInfo(chainId) }),
      )
      break

    case "OrderCancelled":
      // Cancellation unlocks reserved funds and removes order
      tasks.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.tokenBalances(chainId, account) }),
      )
      break

    case "OrderCreated":
      // Creation reserves funds and adds order
      tasks.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(chainId, account) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.tokenBalances(chainId, account) }),
      )
      break

    case "OrderUpdated":
      // Updates order parameters
      tasks.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(chainId, account) }),
      )
      break
  }

  await Promise.all(tasks)
}
