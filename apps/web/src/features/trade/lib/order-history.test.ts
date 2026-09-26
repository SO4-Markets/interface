import { describe, expect, it } from "vitest"
import {
  
  
  buildOrderHistoryRow,
  dedupeById,
  filterFills,
  mergePagesByStableId,
  nextRetainedPrefixSize,
} from "./order-history"
import { deriveOrderLifecycleStage } from "./order-lifecycle"
import type { FillRecord, OrderHistorySource } from "./order-history"

const order: OrderHistorySource = {
  key: "order-1",
  marketKey: "market-btc",
  marketName: "BTC/USD",
  orderType: "LimitIncrease",
  isLong: true,
  status: "UPDATED",
  sizeUsd: 100,
}

function fill(id: string, sizeUsd: number, timestamp: number): FillRecord {
  return {
    id,
    orderKey: "order-1",
    marketKey: "market-btc",
    marketName: "BTC/USD",
    isLong: true,
    changeType: "increase",
    sizeUsd,
    executionPriceUsd: 50_000,
    positionFeeUsd: 1,
    pnlUsd: 0,
    timestamp,
  }
}

describe("order history", () => {
  it("aggregates multiple fills without executing the remainder", () => {
    const row = buildOrderHistoryRow(order, {
      fillCount: 2,
      filledSizeUsd: 60,
      averageExecutionPrice: 50_000,
      feesUsd: 2,
      lastFillAt: 2,
    })

    expect(row.originalSizeUsd).toBe(100)
    expect(row.filledSizeUsd).toBe(60)
    expect(row.remainingSizeUsd).toBe(40)
    expect(row.fillPercent).toBe(60)
    expect(row.stage).toBe("partially-filled")
  })

  it("deduplicates overlapping page records before totals are calculated", () => {
    const rows = dedupeById([
      fill("fill-1", 30, 1),
      fill("fill-1", 30, 1),
      fill("fill-2", 30, 2),
    ])

    expect(rows).toHaveLength(2)
    expect(rows.reduce((total, item) => total + item.sizeUsd, 0)).toBe(60)
  })

  it("keeps filters deterministic for market, side, and time range", () => {
    const rows = [
      fill("long", 10, 900),
      {
        ...fill("short", 10, 1_000),
        isLong: false,
        marketKey: "market-eth",
      },
    ]

    expect(
      filterFills(
        rows,
        { marketKey: "market-btc", side: "long", range: "all" },
        1_000,
      ),
    ).toHaveLength(1)
    expect(
      filterFills(
        rows,
        { marketKey: null, side: "short", range: "all" },
        1_000,
      ),
    ).toHaveLength(1)
    expect(
      filterFills(
        rows,
        { marketKey: null, side: "all", range: "24h" },
        86_400_000 + 1_000,
      ),
    ).toHaveLength(1)
  })

  it("merges refreshed and retained pages by stable source id", () => {
    const initial = [
      { id: "a", timestamp: 100 },
      { id: "b", timestamp: 100 },
      { id: "c", timestamp: 90 },
    ]
    const refreshedPrefix = [
      { id: "new", timestamp: 100 },
      { id: "a", timestamp: 100 },
      { id: "b", timestamp: 100 },
      { id: "c", timestamp: 90 },
    ]

    const merged = mergePagesByStableId(
      [initial, refreshedPrefix],
      (row) => row.id,
    )

    expect(merged.map((row) => row.id)).toEqual(["new", "a", "b", "c"])
    expect(new Set(merged.map((row) => row.id)).size).toBe(merged.length)
  })

  it("grows a retained prefix only while the previous prefix is full", () => {
    expect(nextRetainedPrefixSize(25, 25, 25)).toBe(50)
    expect(nextRetainedPrefixSize(50, 50, 25)).toBe(75)
    expect(nextRetainedPrefixSize(48, 50, 25)).toBeUndefined()
  })
})

describe("order lifecycle", () => {
  it("does not call a partially filled order filled", () => {
    expect(
      deriveOrderLifecycleStage({
        status: "EXECUTED",
        originalSizeUsd: 100,
        filledSizeUsd: 60,
      }),
    ).toBe("partially-filled")
  })

  it("only calls an order filled when its full size is accounted for", () => {
    expect(
      deriveOrderLifecycleStage({
        status: "EXECUTED",
        originalSizeUsd: 100,
        filledSizeUsd: 100,
      }),
    ).toBe("filled")
  })

  it("does not infer a fill from an executed status without a fill record", () => {
    expect(
      deriveOrderLifecycleStage({
        status: "EXECUTED",
        originalSizeUsd: 100,
        filledSizeUsd: 0,
      }),
    ).toBe("accepted")
  })
})
