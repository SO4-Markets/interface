/**
 * apps/web/src/features/trade/lib/pending-orders.ts
 *
 * Client-side registry of orders whose transaction is confirmed but which the
 * indexer has not served yet (OB-082).
 *
 * Why this exists: a confirmed order used to fall into a gap — the live
 * contract read no longer listed it as pending, and the indexer had not caught
 * up, so the Orders tab rendered "No open orders" over a real order. Tracking
 * the submission locally closes that gap and gives the row a stable identity
 * until the authoritative key arrives.
 *
 * The registry is a plain module store (not React state) so tracking survives
 * a dialog being dismissed, a tab switch, or a component remount.
 */

import { useMemo, useSyncExternalStore } from "react"
import type { OrderType } from "../hooks/useOrders"

export type PendingOrder = {
  /** Identity that survives the indexer assigning an authoritative key. */
  clientOrderId: string
  account: string
  marketAddress: string
  marketName: string
  orderType: OrderType
  isLong: boolean
  sizeUsd: number
  triggerPrice: number
  /** ms since epoch, used to reconcile against freshly indexed orders. */
  submittedAt: number
  txHash: string | null
}

export type PendingOrderDraft = {
  marketAddress: string
  marketName?: string
  orderType: OrderType
  isLong: boolean
  sizeUsd: number
  triggerPrice?: number
  txHash?: string | null
}

/** Stop trusting an un-indexed submission after this long. */
export const PENDING_ORDER_TTL_MS = 10 * 60_000

const EMPTY_SNAPSHOT: ReadonlyArray<PendingOrder> = []

let entries: ReadonlyArray<PendingOrder> = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()
let sequence = 0

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: ReadonlyArray<PendingOrder>): void {
  entries = next
  emit()
}

function nextClientOrderId(): string {
  sequence += 1
  return `pending-${Date.now().toString(36)}-${sequence.toString(36)}`
}

/**
 * Record a confirmed-but-not-yet-indexed order.
 * Idempotent per call: each submission gets its own `clientOrderId`.
 */
export function registerPendingOrder(
  account: string,
  draft: PendingOrderDraft,
): string {
  if (!account) return ""
  const clientOrderId = nextClientOrderId()
  const entry: PendingOrder = {
    clientOrderId,
    account,
    marketAddress: draft.marketAddress,
    marketName: draft.marketName ?? draft.marketAddress,
    orderType: draft.orderType,
    isLong: draft.isLong,
    sizeUsd: draft.sizeUsd,
    triggerPrice: draft.triggerPrice ?? 0,
    submittedAt: Date.now(),
    txHash: draft.txHash ?? null,
  }
  commit([...entries, entry])
  return clientOrderId
}

/** Drop a pending row once the indexer has served the real order. */
export function resolvePendingOrder(clientOrderId: string): void {
  if (!entries.some((entry) => entry.clientOrderId === clientOrderId)) return
  commit(entries.filter((entry) => entry.clientOrderId !== clientOrderId))
}

export function resolvePendingOrdersForAccount(account: string): void {
  if (!entries.some((entry) => entry.account === account)) return
  commit(entries.filter((entry) => entry.account !== account))
}

/** Remove entries older than the TTL so a row cannot get stuck forever. */
export function pruneExpiredPendingOrders(now = Date.now()): void {
  const next = entries.filter(
    (entry) => now - entry.submittedAt < PENDING_ORDER_TTL_MS,
  )
  if (next.length === entries.length) return
  commit(next)
}

export function getPendingOrdersSnapshot(): ReadonlyArray<PendingOrder> {
  return entries
}

export function subscribePendingOrders(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam — the module store would otherwise leak between test cases. */
export function resetPendingOrders(): void {
  commit(EMPTY_SNAPSHOT)
}

export function usePendingOrders(
  account: string | null,
): ReadonlyArray<PendingOrder> {
  const snapshot = useSyncExternalStore(
    subscribePendingOrders,
    getPendingOrdersSnapshot,
    getPendingOrdersSnapshot,
  )

  return useMemo(() => {
    if (!account) return EMPTY_SNAPSHOT
    const now = Date.now()
    return snapshot.filter(
      (entry) =>
        entry.account === account && now - entry.submittedAt < PENDING_ORDER_TTL_MS,
    )
  }, [account, snapshot])
}
