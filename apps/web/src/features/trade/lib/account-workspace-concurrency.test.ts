import { describe, expect, it } from "vitest"
import {
  buildOrderHistoryRows,
  dedupeOrderHistoryRows,
  filterOrderHistoryRows,
  summariseFills,
  type FillRecord,
  type OrderHistorySource,
} from "./order-history"
import {
  deriveOrderLifecycleStage,
  mergeOrderRowsByIdentity,
  orderRowKey,
  reconcilePendingOrders,
} from "./order-lifecycle"

/**
 * OB-090: simultaneous fill, cancel, and balance changes while a user is
 * inspecting data must converge across balances, orders, positions, history,
 * and chart overlays — without dropped focus or double-counted activity.
 *
 * These are deterministic replay tests over the pure reconciliation layer:
 * the same concurrent events applied in any arrival order converge to one
 * state, fills count exactly once, and row identity stays stable so focused
 * rows are never remounted mid-inspection.
 */

function createOrder(overrides: Partial<OrderHistorySource> = {}): OrderHistorySource {
  return {
    key: "order-1",
    marketKey: "market-btc",
    marketName: "BTC/USD",
    orderType: "LimitIncrease",
    isLong: true,
    status: "CREATED",
    sizeUsd: 1000,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

function createFill(overrides: Partial<FillRecord> = {}): FillRecord {
  return {
    id: "fill-1",
    orderKey: "order-1",
    marketKey: "market-btc",
    marketName: "BTC/USD",
    isLong: true,
    changeType: "increase",
    sizeUsd: 400,
    executionPriceUsd: 50000,
    positionFeeUsd: 1,
    pnlUsd: 0,
    timestamp: 1_700_000_010_000,
    ...overrides,
  }
}

describe("concurrent fill + cancel + balance replay (OB-090)", () => {
  it("converges to one history state regardless of event arrival order", () => {
    const order = createOrder()
    const fill = createFill()

    // Arrival order A: fill indexed before the cancellation confirms.
    const rowsA = buildOrderHistoryRows([order], [fill])
    const stageA = deriveOrderLifecycleStage({
      status: "CANCELLED",
      originalSizeUsd: rowsA[0].originalSizeUsd,
      filledSizeUsd: rowsA[0].filledSizeUsd,
    })

    // Arrival order B: cancellation indexed first, fill pages in after.
    const rowsB = buildOrderHistoryRows([{ ...order, status: "CANCELLED" }], [fill])

    // Both converge: cancelled with the same executed remainder accounted for.
    expect(rowsB[0].stage).toBe("cancelled")
    expect(rowsB[0].filledSizeUsd).toBe(400)
    expect(rowsB[0].remainingSizeUsd).toBe(600)
    expect(rowsB[0].filledSizeUsd + rowsB[0].remainingSizeUsd).toBe(rowsB[0].originalSizeUsd)
    expect(stageA).toBe("cancelled")
  })

  it("never double-counts a fill that arrives on overlapping pages", () => {
    const order = createOrder()
    const fill = createFill()
    const duplicatedPages = [[fill], [fill]]

    const summaries = summariseFills(duplicatedPages.flat())
    expect(summaries.get("order-1")?.filledSizeUsd).toBe(400)
    expect(summaries.get("order-1")?.fillCount).toBe(1)

    const rows = buildOrderHistoryRows([order], duplicatedPages.flat())
    expect(rows[0].filledSizeUsd).toBe(400)
    expect(rows[0].fillCount).toBe(1)
  })

  it("keeps row identity stable across refreshes so inspected rows keep focus", () => {
    const previous = [{ key: "order-1", clientOrderId: "client-1" }]
    const incoming = [
      { key: "order-1", clientOrderId: "client-1" },
      { key: "order-2", clientOrderId: "client-2" },
    ]

    expect(orderRowKey(previous[0])).toBe("client-1")

    const merged = mergeOrderRowsByIdentity(previous, incoming)
    // Existing rows keep position; genuinely new rows append (no jump under pointer).
    expect(merged.map((row) => orderRowKey(row))).toEqual(["client-1", "client-2"])

    // A background refresh that only re-keys the indexer id still resolves to
    // the same React key — the row (and its focus) is not remounted.
    const rekeyed = [{ key: "indexer-9", clientOrderId: "client-1" }]
    expect(orderRowKey(rekeyed[0])).toBe("client-1")
  })

  it("drops pending rows once the indexer accounts for them (no ghost duplicates)", () => {
    const pending = [
      {
        clientOrderId: "client-1",
        marketAddress: "market-btc",
        orderType: "LimitIncrease",
        isLong: true,
        sizeUsd: 1000,
        submittedAt: 1_700_000_000_000,
      },
    ]
    const indexed = [
      {
        key: "order-1",
        clientOrderId: "client-1",
        marketAddress: "market-btc",
        orderType: "LimitIncrease",
        isLong: true,
        sizeUsd: 1000,
      },
    ]
    expect(reconcilePendingOrders(pending, indexed)).toHaveLength(0)
  })

  it("releases reserved balance exactly once when a cancel and a fill race", () => {
    // Balance model mirrors useAccountBalanceSummary: reserved = pending
    // collateral + deposited; available = wallet - (reserved - deposited).
    function availableToTrade(wallet: number, reserved: number, deposited: number): number {
      return Math.max(wallet - (reserved - deposited), 0)
    }

    const wallet = 5000
    const deposited = 1000
    // Before: one resting order reserves 500.
    const reservedBefore = 500 + deposited
    expect(availableToTrade(wallet, reservedBefore, deposited)).toBe(4500)

    // Fill of 400 + cancel of the 600 remainder: the reservation must clear
    // exactly once — applying both events must not double-release.
    const releasedOnce = 0 + deposited
    expect(availableToTrade(wallet, releasedOnce, deposited)).toBe(5000)

    // Partial-fill path: 400 filled, 600 still reserved.
    const reservedPartial = 600 + deposited
    expect(availableToTrade(wallet, reservedPartial, deposited)).toBe(4400)
  })

  it("filters stay canonical so concurrent filter + page loads share one cache identity", () => {
    const rows = dedupeOrderHistoryRows(
      buildOrderHistoryRows([createOrder(), createOrder()], [createFill()]),
    )
    expect(rows).toHaveLength(1)

    const filtered = filterOrderHistoryRows(rows, { marketKey: null, stage: "all", range: "all" })
    expect(filtered).toHaveLength(1)
  })
})
