export type AttachedOrder = {
  type: "takeProfit" | "stopLoss"
  triggerPrice: string
  sizePct: number
}

/**
 * Capabilities are deliberately conservative until the gateway exposes and
 * verifies these semantics. Decrease order types are supported directly by
 * the venue; attached orders and a separate reduce-only flag are not.
 */
export const EXECUTION_SUPPORT = {
  reduceOnly: false,
  attachedTriggers: false,
} as const

export type ExecutionRequest = {
  reduceOnly?: boolean
  attachedOrders?: ReadonlyArray<AttachedOrder>
}

export type ExecutionValidation =
  | { valid: true }
  | { valid: false; reason: string }

export function validateExecutionRequest(request: ExecutionRequest): ExecutionValidation {
  if (request.reduceOnly && !EXECUTION_SUPPORT.reduceOnly) {
    return {
      valid: false,
      reason: "Reduce-only orders are unavailable until the execution gateway enforces them.",
    }
  }

  if ((request.attachedOrders?.length ?? 0) > 0 && !EXECUTION_SUPPORT.attachedTriggers) {
    return {
      valid: false,
      reason: "Take-profit and stop-loss attachments are unavailable until the execution gateway supports them.",
    }
  }

  return { valid: true }
}
