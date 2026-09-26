import { describe, expect, it } from "vitest"
import {
  detectFillDuringEditing,
  foldAmendReplaceOutcome,
  getOrderAmendCapability,
  resolveAmendReplaceSteps,
  validateAmendPayload,
} from "./order-amendment"

describe("getOrderAmendCapability (OB-084)", () => {
  it("amends trigger and size for resting limit orders", () => {
    const capability = getOrderAmendCapability({ orderType: "LimitIncrease", stage: "accepted" })
    expect(capability.canAmend).toBe(true)
    expect(capability.canAmendTrigger).toBe(true)
    expect(capability.canAmendSize).toBe(true)
    expect(capability.requiresCancelReplace).toBe(true)
    expect(capability.losesQueuePriority).toBe(true)
    expect(capability.reason).toBeNull()
  })

  it("supports partially-filled rows (remaining size only)", () => {
    const capability = getOrderAmendCapability({ orderType: "LimitDecrease", stage: "partially-filled" })
    expect(capability.canAmend).toBe(true)
  })

  it("offers no enabled action for market orders", () => {
    for (const orderType of ["MarketIncrease", "MarketDecrease", "MarketSwap"] as const) {
      const capability = getOrderAmendCapability({ orderType, stage: "accepted" })
      expect(capability.canAmend).toBe(false)
      expect(capability.reason).toMatch(/market orders/i)
    }
  })

  it("blocks frozen, filled, cancelled, pending, and indexing rows", () => {
    expect(getOrderAmendCapability({ orderType: "LimitIncrease", stage: "frozen" }).reason).toMatch(/frozen/i)
    expect(getOrderAmendCapability({ orderType: "LimitIncrease", stage: "filled" }).canAmend).toBe(false)
    expect(getOrderAmendCapability({ orderType: "LimitIncrease", stage: "cancelled" }).canAmend).toBe(false)
    expect(getOrderAmendCapability({ orderType: "LimitIncrease", stage: "pending" }).canAmend).toBe(false)
    expect(getOrderAmendCapability({ orderType: "LimitIncrease", stage: "pending-cancellation" }).canAmend).toBe(false)
    expect(
      getOrderAmendCapability({ orderType: "LimitIncrease", stage: "accepted", awaitingIndex: true }).reason,
    ).toMatch(/indexer/i)
  })
})

describe("validateAmendPayload (OB-084)", () => {
  const context = {
    orderType: "LimitIncrease" as const,
    stage: "accepted" as const,
    currentTriggerPrice: 100,
    remainingSizeUsd: 1000,
  }

  it("accepts a trigger and size change inside tick/lot rules", () => {
    expect(validateAmendPayload({ triggerPrice: 101.5, sizeUsd: 500 }, context)).toBeNull()
  })

  it("requires at least one changed field", () => {
    expect(validateAmendPayload({}, context)).toMatch(/change/i)
  })

  it("rejects sizes above the current remaining size", () => {
    expect(validateAmendPayload({ sizeUsd: 1000.01 }, context)).toMatch(/remaining/i)
  })

  it("enforces the minimum order size", () => {
    expect(validateAmendPayload({ sizeUsd: 5 }, context)).toMatch(/minimum/i)
  })

  it("enforces price ticks", () => {
    expect(validateAmendPayload({ triggerPrice: 100.005 }, context)).toMatch(/tick/i)
  })

  it("offers no enabled action for unsupported amendments", () => {
    expect(
      validateAmendPayload(
        { triggerPrice: 101 },
        { ...context, orderType: "MarketIncrease" },
      ),
    ).toMatch(/cannot be amended/i)
  })
})

describe("detectFillDuringEditing (OB-084)", () => {
  it("flags a fill that landed while the dialog was open", () => {
    expect(detectFillDuringEditing(200, 400)).toMatch(/filled while editing/i)
  })

  it("stays silent when nothing filled", () => {
    expect(detectFillDuringEditing(200, 200)).toBeNull()
  })
})

describe("cancel-and-replace steps (OB-084)", () => {
  it("resolves cancel then create, re-deriving acceptable price on trigger changes", () => {
    const steps = resolveAmendReplaceSteps(
      {
        orderKey: "order-1",
        account: "GABC",
        marketAddress: "market-1",
        collateralToken: "USDC",
        orderType: "LimitIncrease",
        isLong: true,
        acceptablePrice: 100,
        originalTriggerPrice: 100,
        positionKey: null,
        payload: { triggerPrice: 110, sizeUsd: 500 },
      },
      1000,
    )
    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({ kind: "cancel", orderKey: "order-1" })
    expect(steps[1].kind).toBe("create")
    if (steps[1].kind === "create") {
      expect(steps[1].sizeUsd).toBe(500)
      expect(steps[1].triggerPrice).toBe(110)
      // Long replacement tolerates upward slippage around the new trigger.
      expect(steps[1].acceptablePrice).toBeCloseTo(110.55, 5)
    }
  })

  it("keeps the original trigger and acceptable price for size-only changes", () => {
    const steps = resolveAmendReplaceSteps(
      {
        orderKey: "order-1",
        account: "GABC",
        marketAddress: "market-1",
        collateralToken: "USDC",
        orderType: "LimitDecrease",
        isLong: false,
        acceptablePrice: 99,
        originalTriggerPrice: 101,
        positionKey: "pos-1",
        payload: { sizeUsd: 250 },
      },
      1000,
    )
    if (steps[1].kind === "create") {
      expect(steps[1].acceptablePrice).toBe(99)
      expect(steps[1].triggerPrice).toBe(101)
    } else {
      expect.unreachable("second step must be create")
    }
  })

  it("never presents a cancelled original as live when replacement fails", () => {
    const outcome = foldAmendReplaceOutcome({ cancelTxHash: "cancel-hash", createError: "out of funds" })
    expect(outcome.status).toBe("replace-failed")
    if (outcome.status === "replace-failed") {
      expect(outcome.originalGone).toBe(true)
      expect(outcome.cancelTxHash).toBe("cancel-hash")
    }
  })

  it("keeps the original live when cancellation itself fails", () => {
    const outcome = foldAmendReplaceOutcome({ cancelError: "user rejected" })
    expect(outcome).toEqual({ status: "cancel-failed", error: "user rejected" })
  })
})
