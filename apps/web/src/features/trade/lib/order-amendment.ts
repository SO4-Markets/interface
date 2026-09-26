/**
 * apps/web/src/features/trade/lib/order-amendment.ts
 *
 * Capability-aware order amendment (OB-084).
 *
 * The venue exposes no `update_order` entrypoint — only `create_order`,
 * `cancel_order`, and `batch` (see `apps/web/src/lib/contracts.ts`). An
 * amendment is therefore always a cancel-and-replace executed as two separate
 * consequential steps:
 *
 *   1. Cancel the resting order.
 *   2. Create a replacement order with the amended fields.
 *
 * Consequences the UI must surface:
 * - The replacement loses queue priority: it joins the back of the queue at
 *   the new price/size instead of keeping the original's place.
 * - If step 1 succeeds and step 2 fails, the original order is gone and must
 *   never be presented as still live (see `AmendReplaceOutcome`).
 *
 * Only fields the venue can amend are editable. Market orders have no resting
 * trigger to amend and execute immediately, so they expose no edit action.
 * Frozen, pending, cancelling, filled, and cancelled rows are not amendable.
 */

import type { OrderLifecycleStage } from "./order-lifecycle"
import type { OrderType } from "../hooks/useOrders"

export const AMEND_PRICE_TICK_USD = 0.01
export const AMEND_SIZE_TICK_USD = 0.01
export const AMEND_MIN_REMAINING_USD = 10

const AMENDABLE_TRIGGER_TYPES: ReadonlySet<OrderType> = new Set([
  "LimitIncrease",
  "LimitDecrease",
  "StopLossDecrease",
  "LimitSwap",
])

const AMENDABLE_SIZE_TYPES: ReadonlySet<OrderType> = new Set([
  "LimitIncrease",
  "LimitDecrease",
  "StopLossDecrease",
  "LimitSwap",
])

const AMENDABLE_STAGES: ReadonlySet<OrderLifecycleStage> = new Set([
  "accepted",
  "partially-filled",
])

export type OrderAmendCapability = {
  canAmend: boolean
  canAmendTrigger: boolean
  canAmendSize: boolean
  /** Human-readable reason when `canAmend` is false. Null when amendable. */
  reason: string | null
  /** Always true on this venue: there is no in-place update entrypoint. */
  requiresCancelReplace: true
  /** Replacement joins the back of the queue (OB-084). */
  losesQueuePriority: boolean
}

export type AmendCapabilityInput = {
  orderType: OrderType | string
  stage: OrderLifecycleStage
  awaitingIndex?: boolean
}

export function getOrderAmendCapability(input: AmendCapabilityInput): OrderAmendCapability {
  const base = {
    requiresCancelReplace: true as const,
    losesQueuePriority: true,
  }

  if (input.awaitingIndex) {
    return {
      ...base,
      canAmend: false,
      canAmendTrigger: false,
      canAmendSize: false,
      reason: "Waiting for the indexer to confirm this order",
    }
  }

  if (!AMENDABLE_STAGES.has(input.stage)) {
    return {
      ...base,
      canAmend: false,
      canAmendTrigger: false,
      canAmendSize: false,
      reason: amendBlockedReason(input.stage),
    }
  }

  const canAmendTrigger = AMENDABLE_TRIGGER_TYPES.has(input.orderType as OrderType)
  const canAmendSize = AMENDABLE_SIZE_TYPES.has(input.orderType as OrderType)

  if (!canAmendTrigger && !canAmendSize) {
    return {
      ...base,
      canAmend: false,
      canAmendTrigger: false,
      canAmendSize: false,
      reason: "Market orders execute immediately and cannot be amended",
    }
  }

  return {
    ...base,
    canAmend: true,
    canAmendTrigger,
    canAmendSize,
    reason: null,
  }
}

function amendBlockedReason(stage: OrderLifecycleStage): string {
  switch (stage) {
    case "pending":
      return "Waiting for the indexer to confirm this order"
    case "pending-cancellation":
      return "Cancellation already in flight"
    case "frozen":
      return "Frozen orders cannot be amended while execution is paused"
    case "filled":
      return "Filled orders cannot be amended"
    case "cancelled":
      return "Cancelled orders cannot be amended"
    default:
      return "This order cannot be amended in its current state"
  }
}

export type AmendPayload = {
  /** New trigger/limit price in USD. Omit to keep the current price. */
  triggerPrice?: number
  /** New total remaining size in USD. Omit to keep the current size. */
  sizeUsd?: number
}

export type AmendValidationContext = {
  orderType: OrderType | string
  stage: OrderLifecycleStage
  awaitingIndex?: boolean
  /** Current trigger price in USD (0 when the order has none). */
  currentTriggerPrice: number
  /** Current remaining (unfilled) size in USD. */
  remainingSizeUsd: number
  /** Filled size in USD — used to detect a fill during editing. */
  filledSizeUsd?: number
}

function isTickAligned(value: number, tick: number): boolean {
  const steps = value / tick
  return Math.abs(steps - Math.round(steps)) < 1e-6
}

/**
 * Validate an amendment against *current* remaining size and tick/lot rules.
 * Returns a human-readable error, or null when the payload is valid.
 */
export function validateAmendPayload(
  payload: AmendPayload,
  context: AmendValidationContext,
): string | null {
  const capability = getOrderAmendCapability({
    orderType: context.orderType,
    stage: context.stage,
    awaitingIndex: context.awaitingIndex,
  })
  if (!capability.canAmend) {
    return capability.reason ?? "This order cannot be amended"
  }

  const wantsTrigger = payload.triggerPrice !== undefined
  const wantsSize = payload.sizeUsd !== undefined
  if (!wantsTrigger && !wantsSize) {
    return "Change the trigger price or size to replace this order"
  }

  if (wantsTrigger) {
    if (!capability.canAmendTrigger) {
      return "Trigger price cannot be amended for this order type"
    }
    const price = payload.triggerPrice as number
    if (!Number.isFinite(price) || price <= 0) {
      return "Enter a trigger price greater than 0"
    }
    if (!isTickAligned(price, AMEND_PRICE_TICK_USD)) {
      return `Trigger price must move in $${AMEND_PRICE_TICK_USD.toFixed(2)} ticks`
    }
  }

  if (wantsSize) {
    if (!capability.canAmendSize) {
      return "Size cannot be amended for this order type"
    }
    const size = payload.sizeUsd as number
    if (!Number.isFinite(size) || size <= 0) {
      return "Enter a size greater than 0"
    }
    if (size > context.remainingSizeUsd + 1e-9) {
      return "Size cannot exceed the current remaining size"
    }
    if (size < AMEND_MIN_REMAINING_USD) {
      return `Size must be at least $${AMEND_MIN_REMAINING_USD} (minimum order size)`
    }
    if (!isTickAligned(size, AMEND_SIZE_TICK_USD)) {
      return `Size must move in $${AMEND_SIZE_TICK_USD.toFixed(2)} steps`
    }
  }

  return null
}

/**
 * Detect a fill that landed while the trader was editing (OB-084).
 *
 * The dialog captures `filledSizeUsd` on open; before submitting, the caller
 * re-reads the row and compares. A mismatch means the remaining size the
 * trader validated against is stale.
 */
export function detectFillDuringEditing(
  filledAtDialogOpen: number,
  currentFilledSizeUsd: number,
): string | null {
  if (Math.abs(currentFilledSizeUsd - filledAtDialogOpen) > 1e-9) {
    return "This order filled while editing — review the remaining size before replacing"
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel-and-replace orchestration (pure step resolution)
// ─────────────────────────────────────────────────────────────────────────────

export type AmendReplaceRequest = {
  orderKey: string
  account: string
  marketAddress: string
  collateralToken: string
  orderType: OrderType
  isLong: boolean
  /** Acceptable price of the original order (reused for size-only changes). */
  acceptablePrice: number
  /** Trigger price of the original order (carried over for size-only changes). */
  originalTriggerPrice: number
  /** Position key for decrease orders; null for increase orders. */
  positionKey: string | null
  payload: AmendPayload
}

export type AmendReplaceStep =
  | { kind: "cancel"; orderKey: string }
  | {
      kind: "create"
      marketAddress: string
      orderType: OrderType
      isLong: boolean
      sizeUsd: number
      triggerPrice?: number
      acceptablePrice: number
    }

/** Outcome of the two consequential steps. Never present `originalGone` rows as live. */
export type AmendReplaceOutcome =
  | { status: "replaced"; cancelTxHash: string; createTxHash: string }
  | { status: "cancel-failed"; error: string }
  | {
      status: "replace-failed"
      cancelTxHash: string
      error: string
      /** The original order is gone; the UI must show cancelled + failed replacement. */
      originalGone: true
    }

/**
 * Resolve the two consequential steps for a cancel-and-replace.
 *
 * Size-only changes keep the original acceptable price; trigger changes
 * re-derive it with ±0.5% slippage around the new trigger (long: above for
 * increase execution tolerance, short: below — matching `createSidecarOrder`).
 */
export function resolveAmendReplaceSteps(
  request: AmendReplaceRequest,
  currentRemainingSizeUsd: number,
): Array<AmendReplaceStep> {
  const sizeUsd = request.payload.sizeUsd ?? currentRemainingSizeUsd
  let acceptablePrice = request.acceptablePrice
  let triggerPrice: number | undefined = request.originalTriggerPrice > 0 ? request.originalTriggerPrice : undefined

  if (request.payload.triggerPrice !== undefined) {
    triggerPrice = request.payload.triggerPrice
    const slippage = 0.005
    acceptablePrice = request.isLong
      ? triggerPrice * (1 + slippage)
      : triggerPrice * (1 - slippage)
  }

  return [
    { kind: "cancel", orderKey: request.orderKey },
    {
      kind: "create",
      marketAddress: request.marketAddress,
      orderType: request.orderType,
      isLong: request.isLong,
      sizeUsd,
      triggerPrice,
      acceptablePrice,
    },
  ]
}

/**
 * Fold step results into the outcome the UI must present (OB-084).
 *
 * - Cancel failed → the original is still live; surface the error on the row.
 * - Cancel ok + create failed → the original is gone; never render it as live.
 */
export function foldAmendReplaceOutcome(input: {
  cancelError?: string
  cancelTxHash?: string
  createError?: string
  createTxHash?: string
}): AmendReplaceOutcome {
  if (input.cancelError || !input.cancelTxHash) {
    return { status: "cancel-failed", error: input.cancelError ?? "Cancellation failed" }
  }
  if (input.createError || !input.createTxHash) {
    return {
      status: "replace-failed",
      cancelTxHash: input.cancelTxHash,
      error: input.createError ?? "Replacement order failed",
      originalGone: true,
    }
  }
  return { status: "replaced", cancelTxHash: input.cancelTxHash, createTxHash: input.createTxHash }
}
