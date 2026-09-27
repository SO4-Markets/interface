/**
 * Ledger Confirmation & Indexer Catch-up Reconciliation (OB-115)
 *
 * Provides deterministic reconciliation between on-chain ledger confirmations
 * and delayed indexer data:
 * 1. Tracks ConfirmedLedgerEvidence with bounded lifecycle states ("syncing" | "caught-up" | "sync-timeout").
 * 2. Filters out cancelled/closed items and injects optimistic entries during indexer lag.
 * 3. Bounded polling and catch-up verification with manual retry fallback.
 */

export type LedgerMutationType =
  | "CREATE_ORDER"
  | "CANCEL_ORDER"
  | "AMEND_ORDER"
  | "CLOSE_POSITION"
  | "ADJUST_COLLATERAL"

export type SyncState = "syncing" | "caught-up" | "sync-timeout"

export interface ConfirmedLedgerEvidence {
  id: string
  txHash: string
  account: string
  mutationType: LedgerMutationType
  targetKey?: string // e.g. orderKey or positionKey
  marketKey?: string
  timestamp: number
  status: SyncState
  attempts: number
  lastChecked: number
  optimisticOrder?: any
  optimisticPosition?: any
}

export const MAX_SYNC_TIMEOUT_MS = 30_000
export const SYNC_POLL_INTERVAL_MS = 2_000

export class LedgerReconciliationStore {
  private evidences: Map<string, ConfirmedLedgerEvidence> = new Map()
  private listeners: Set<() => void> = new Set()

  public addEvidence(evidence: Omit<ConfirmedLedgerEvidence, "status" | "attempts" | "lastChecked">): ConfirmedLedgerEvidence {
    const entry: ConfirmedLedgerEvidence = {
      ...evidence,
      status: "syncing",
      attempts: 0,
      lastChecked: Date.now(),
    }
    this.evidences.set(entry.id, entry)
    this.notify()
    return entry
  }

  public getEvidences(account?: string): Array<ConfirmedLedgerEvidence> {
    const all = Array.from(this.evidences.values())
    if (!account) return all
    return all.filter((e) => e.account.toLowerCase() === account.toLowerCase())
  }

  public getActiveEvidences(account?: string): Array<ConfirmedLedgerEvidence> {
    return this.getEvidences(account).filter((e) => e.status === "syncing")
  }

  public updateStatus(id: string, status: SyncState): void {
    const existing = this.evidences.get(id)
    if (existing) {
      existing.status = status
      existing.lastChecked = Date.now()
      this.notify()
    }
  }

  public markCaughtUp(id: string): void {
    this.updateStatus(id, "caught-up")
    // Retain caught-up items briefly for UI feedback then clean up
    setTimeout(() => {
      this.evidences.delete(id)
      this.notify()
    }, 5_000)
  }

  public retrySync(id: string): void {
    const existing = this.evidences.get(id)
    if (existing) {
      existing.status = "syncing"
      existing.timestamp = Date.now()
      existing.attempts = 0
      this.notify()
    }
  }

  public checkTimeouts(now = Date.now()): void {
    let changed = false
    for (const evidence of this.evidences.values()) {
      if (evidence.status === "syncing" && now - evidence.timestamp > MAX_SYNC_TIMEOUT_MS) {
        evidence.status = "sync-timeout"
        changed = true
      }
    }
    if (changed) this.notify()
  }

  public clear(): void {
    this.evidences.clear()
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

export const ledgerReconciliation = new LedgerReconciliationStore()

export interface ReconciledOrdersResult<TOrder = any> {
  orders: Array<TOrder>
  isSyncing: boolean
  syncCount: number
  timedOutCount: number
}

/** Reconciles indexed orders against confirmed ledger evidence. */
export function reconcileOrders<TOrder extends { key?: string; id?: string; clientOrderId?: string; awaitingIndex?: boolean; status?: string }>(
  indexerOrders: Array<TOrder>,
  evidences: Array<ConfirmedLedgerEvidence>,
): ReconciledOrdersResult<TOrder> {
  const activeEvidences = evidences.filter((e) => e.status === "syncing")
  const timedOutEvidences = evidences.filter((e) => e.status === "sync-timeout")

  const cancelledOrderKeys = new Set(
    activeEvidences
      .filter((e) => e.mutationType === "CANCEL_ORDER" && Boolean(e.targetKey))
      .map((e) => e.targetKey!),
  )

  // 1. Filter out orders confirmed cancelled on-chain that indexer still returns
  let reconciled = indexerOrders.filter((order) => {
    const key = order.key || order.id || order.clientOrderId
    return !key || !cancelledOrderKeys.has(key)
  })

  // 2. Inject optimistic newly created orders that indexer hasn't listed yet
  const createdEvidences = activeEvidences.filter((e) => e.mutationType === "CREATE_ORDER" && e.optimisticOrder)
  for (const ev of createdEvidences) {
    const orderKey = ev.optimisticOrder?.key || ev.optimisticOrder?.clientOrderId || ev.targetKey
    const exists = reconciled.some((o) => (o.key || o.id || o.clientOrderId) === orderKey)
    if (!exists && ev.optimisticOrder) {
      reconciled = [
        {
          ...ev.optimisticOrder,
          awaitingIndex: true,
          isSyncing: true,
        },
        ...reconciled,
      ]
    }
  }

  return {
    orders: reconciled,
    isSyncing: activeEvidences.length > 0,
    syncCount: activeEvidences.length,
    timedOutCount: timedOutEvidences.length,
  }
}

export interface ReconciledPositionsResult<TPosition = any> {
  positions: Array<TPosition>
  isSyncing: boolean
  syncCount: number
  timedOutCount: number
}

/** Reconciles indexed positions against confirmed ledger evidence. */
export function reconcilePositions<TPosition extends { key?: string; id?: string; marketAddress?: string }>(
  indexerPositions: Array<TPosition>,
  evidences: Array<ConfirmedLedgerEvidence>,
): ReconciledPositionsResult<TPosition> {
  const activeEvidences = evidences.filter((e) => e.status === "syncing")
  const timedOutEvidences = evidences.filter((e) => e.status === "sync-timeout")

  const closedPositionKeys = new Set(
    activeEvidences
      .filter((e) => e.mutationType === "CLOSE_POSITION" && Boolean(e.targetKey))
      .map((e) => e.targetKey!),
  )

  // Filter out positions confirmed closed on-chain
  const reconciled = indexerPositions.filter((pos) => {
    const key = pos.key || pos.id
    return !key || !closedPositionKeys.has(key)
  })

  return {
    positions: reconciled,
    isSyncing: activeEvidences.length > 0,
    syncCount: activeEvidences.length,
    timedOutCount: timedOutEvidences.length,
  }
}
