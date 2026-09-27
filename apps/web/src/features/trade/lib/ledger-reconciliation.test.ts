import { beforeEach, describe, expect, it } from "vitest"
import {
  LedgerReconciliationStore,
  reconcileOrders,
  reconcilePositions,
} from "./ledger-reconciliation"

describe("ledger-reconciliation (OB-115)", () => {
  let store: LedgerReconciliationStore

  beforeEach(() => {
    store = new LedgerReconciliationStore()
  })

  it("adds confirmed evidence and tracks active syncing state", () => {
    const ev = store.addEvidence({
      id: "ev-1",
      txHash: "hash-1",
      account: "GBBD47...",
      mutationType: "CREATE_ORDER",
      timestamp: Date.now(),
    })

    expect(ev.status).toBe("syncing")
    expect(store.getActiveEvidences("GBBD47...").length).toBe(1)
  })

  it("reconciles orders by hiding confirmed-cancelled orders during indexer lag", () => {
    const indexerOrders = [
      { key: "order-1", clientOrderId: "order-1", sizeUsd: 100 },
      { key: "order-2", clientOrderId: "order-2", sizeUsd: 200 },
    ]

    const evidences = [
      {
        id: "ev-cancel",
        txHash: "hash-cancel",
        account: "user-1",
        mutationType: "CANCEL_ORDER" as const,
        targetKey: "order-1",
        timestamp: Date.now(),
        status: "syncing" as const,
        attempts: 0,
        lastChecked: Date.now(),
      },
    ]

    const result = reconcileOrders(indexerOrders, evidences)
    expect(result.orders.length).toBe(1)
    expect(result.orders[0]?.key).toBe("order-2")
    expect(result.isSyncing).toBe(true)
    expect(result.syncCount).toBe(1)
  })

  it("reconciles orders by injecting newly created orders before indexer reflects them", () => {
    const indexerOrders: Array<{ key: string; clientOrderId: string; sizeUsd: number; awaitingIndex?: boolean }> = [
      { key: "order-1", clientOrderId: "order-1", sizeUsd: 100 },
    ]

    const evidences = [
      {
        id: "ev-create",
        txHash: "hash-create",
        account: "user-1",
        mutationType: "CREATE_ORDER" as const,
        targetKey: "order-new",
        optimisticOrder: { key: "order-new", clientOrderId: "order-new", sizeUsd: 500 },
        timestamp: Date.now(),
        status: "syncing" as const,
        attempts: 0,
        lastChecked: Date.now(),
      },
    ]

    const result = reconcileOrders(indexerOrders, evidences)
    expect(result.orders.length).toBe(2)
    expect(result.orders[0]?.key).toBe("order-new")
    expect(result.orders[0]?.awaitingIndex).toBe(true)
  })

  it("reconciles positions by hiding closed positions during indexer lag", () => {
    const indexerPositions = [
      { key: "pos-1", marketAddress: "MKT-1" },
      { key: "pos-2", marketAddress: "MKT-2" },
    ]

    const evidences = [
      {
        id: "ev-close",
        txHash: "hash-close",
        account: "user-1",
        mutationType: "CLOSE_POSITION" as const,
        targetKey: "pos-1",
        timestamp: Date.now(),
        status: "syncing" as const,
        attempts: 0,
        lastChecked: Date.now(),
      },
    ]

    const result = reconcilePositions(indexerPositions, evidences)
    expect(result.positions.length).toBe(1)
    expect(result.positions[0]?.key).toBe("pos-2")
    expect(result.isSyncing).toBe(true)
  })

  it("flags timeout after exceeding MAX_SYNC_TIMEOUT_MS and supports retry", () => {
    store.addEvidence({
      id: "ev-old",
      txHash: "hash-old",
      account: "user-1",
      mutationType: "CREATE_ORDER",
      timestamp: Date.now() - 35_000,
    })

    store.checkTimeouts()
    expect(store.getEvidences()[0]?.status).toBe("sync-timeout")

    store.retrySync("ev-old")
    expect(store.getEvidences()[0]?.status).toBe("syncing")
  })
})
