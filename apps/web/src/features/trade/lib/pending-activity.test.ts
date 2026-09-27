import { beforeEach, describe, expect, it } from "vitest"
import {
  PendingActivityStore,
  computeSafeAvailableBalance,
} from "./pending-activity"

describe("pending-activity (OB-116)", () => {
  let store: PendingActivityStore

  beforeEach(() => {
    store = new PendingActivityStore()
  })

  it("adds pending activities and tracks in-flight margin reservations", () => {
    store.addActivity({
      id: "act-1",
      account: "user-1",
      activityType: "create_order",
      reservedMarginUsd: 150,
      sizeUsd: 1500,
    })

    store.addActivity({
      id: "act-2",
      account: "user-1",
      activityType: "create_order",
      reservedMarginUsd: 50,
      sizeUsd: 500,
    })

    expect(store.getPendingMarginReservations("user-1")).toBe(200)
    expect(store.getActivities("user-1").length).toBe(2)
  })

  it("deducts reserved margin from settled balance without inventing unconfirmed settled balances", () => {
    const balance = computeSafeAvailableBalance({
      settledBalanceUsd: 1000,
      pendingMarginReservationsUsd: 250,
    })

    expect(balance.settledBalanceUsd).toBe(1000)
    expect(balance.reservedMarginUsd).toBe(250)
    expect(balance.availableBalanceUsd).toBe(750)
  })

  it("clamps available balance to zero if reservations exceed settled balance", () => {
    const balance = computeSafeAvailableBalance({
      settledBalanceUsd: 100,
      pendingMarginReservationsUsd: 200,
    })

    expect(balance.availableBalanceUsd).toBe(0)
  })

  it("transitions stages cleanly to confirmed and hands over to ledger reconciliation", () => {
    const act = store.addActivity({
      id: "act-create",
      account: "user-1",
      activityType: "create_order",
      reservedMarginUsd: 100,
      metadata: {
        optimisticOrder: { key: "opt-1", clientOrderId: "opt-1" },
      },
    })

    expect(act.stage).toBe("submitting")

    store.updateStage("act-create", "confirming", { txHash: "tx-hash-123" })
    expect(store.getActivities("user-1")[0]?.stage).toBe("confirming")
    expect(store.getActivities("user-1")[0]?.txHash).toBe("tx-hash-123")

    store.updateStage("act-create", "confirmed")
    expect(store.getActivities("user-1")[0]?.stage).toBe("confirmed")
    // Confirmed items no longer reserve margin in the in-flight stage
    expect(store.getPendingMarginReservations("user-1")).toBe(0)
  })
})
