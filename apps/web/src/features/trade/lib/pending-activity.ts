/**
 * Local Pending Activity Overlay & Safe Margin Calculation (OB-116)
 *
 * Implements a local pending activity overlay for trading actions without
 * inventing settled balances:
 * 1. Tracks in-flight submissions keyed by attempt ID / client order identity.
 * 2. Deducts pending margin reservations from available balance so users cannot overspend.
 * 3. Never adds unconfirmed incoming balances into settled balance totals.
 * 4. Cleanly transitions from pending -> confirmed (ledger-reconciling) -> settled.
 */

import { ledgerReconciliation } from "./ledger-reconciliation"

export type PendingActivityType =
  | "create_order"
  | "cancel_order"
  | "amend_order"
  | "close_position"
  | "deposit"
  | "withdraw"

export type PendingStage = "submitting" | "confirming" | "confirmed" | "failed"

export interface PendingActivityItem {
  id: string
  account: string
  activityType: PendingActivityType
  stage: PendingStage
  timestamp: number
  marketSymbol?: string
  side?: "long" | "short"
  sizeUsd?: number
  price?: number
  reservedMarginUsd?: number
  txHash?: string
  error?: string
  metadata?: Record<string, unknown>
}

export class PendingActivityStore {
  private items: Map<string, PendingActivityItem> = new Map()
  private listeners: Set<() => void> = new Set()

  public addActivity(activity: Omit<PendingActivityItem, "stage" | "timestamp">): PendingActivityItem {
    const item: PendingActivityItem = {
      ...activity,
      stage: "submitting",
      timestamp: Date.now(),
    }
    this.items.set(item.id, item)
    this.notify()
    return item
  }

  public updateStage(id: string, stage: PendingStage, extra?: { txHash?: string; error?: string }): void {
    const item = this.items.get(id)
    if (item) {
      item.stage = stage
      if (extra?.txHash) item.txHash = extra.txHash
      if (extra?.error) item.error = extra.error

      if (stage === "confirmed" && item.txHash) {
        // Handover to ledger reconciliation for indexer catch-up
        if (item.activityType === "create_order") {
          ledgerReconciliation.addEvidence({
            id: item.id,
            txHash: item.txHash,
            account: item.account,
            mutationType: "CREATE_ORDER",
            timestamp: Date.now(),
            optimisticOrder: item.metadata?.optimisticOrder,
          })
        } else if (item.activityType === "cancel_order") {
          ledgerReconciliation.addEvidence({
            id: item.id,
            txHash: item.txHash,
            account: item.account,
            mutationType: "CANCEL_ORDER",
            targetKey: item.metadata?.orderKey as string | undefined,
            timestamp: Date.now(),
          })
        } else if (item.activityType === "close_position") {
          ledgerReconciliation.addEvidence({
            id: item.id,
            txHash: item.txHash,
            account: item.account,
            mutationType: "CLOSE_POSITION",
            targetKey: item.metadata?.positionKey as string | undefined,
            timestamp: Date.now(),
          })
        }
      }

      this.notify()
    }
  }

  public removeActivity(id: string): void {
    if (this.items.delete(id)) {
      this.notify()
    }
  }

  public getActivities(account?: string): Array<PendingActivityItem> {
    const all = Array.from(this.items.values())
    if (!account) return all
    return all.filter((i) => i.account.toLowerCase() === account.toLowerCase())
  }

  public getPendingMarginReservations(account?: string): number {
    return this.getActivities(account)
      .filter((i) => (i.stage === "submitting" || i.stage === "confirming") && typeof i.reservedMarginUsd === "number")
      .reduce((sum, i) => sum + (i.reservedMarginUsd || 0), 0)
  }

  public clear(): void {
    this.items.clear()
    this.notify()
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const cb of this.listeners) {
      try {
        cb()
      } catch {}
    }
  }
}

export const pendingActivity = new PendingActivityStore()

export interface BalanceComputationParams {
  settledBalanceUsd: number
  pendingMarginReservationsUsd: number
}

export interface AvailableBalanceResult {
  settledBalanceUsd: number
  reservedMarginUsd: number
  availableBalanceUsd: number
}

/** Computes safe available balance by reserving margin without inventing settled balance. */
export function computeSafeAvailableBalance(params: BalanceComputationParams): AvailableBalanceResult {
  const settled = Math.max(0, params.settledBalanceUsd)
  const reserved = Math.max(0, params.pendingMarginReservationsUsd)
  const available = Math.max(0, settled - reserved)

  return {
    settledBalanceUsd: settled,
    reservedMarginUsd: reserved,
    availableBalanceUsd: available,
  }
}
