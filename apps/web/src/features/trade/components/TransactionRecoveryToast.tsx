import React from "react"
import { toast, type ToastAction } from "@workspace/ui/components/toast"
import {
  getRecoveryActions,
  executeRecoveryAction,
  type TransactionRecoveryContext,
} from "../lib/transaction-explorer"

interface TransactionRecoveryToastProps {
  toastId: string
  context: TransactionRecoveryContext
  callbacks?: {
    onRetry?: () => Promise<void>
    onCancel?: () => Promise<void>
  }
}

/**
 * Displays transaction-specific recovery actions with contextual links
 * Allows users to retry, cancel, or view transaction details
 */
export function showTransactionRecoveryToast(
  props: TransactionRecoveryToastProps
): string {
  const { toastId, context, callbacks } = props
  const actions = getRecoveryActions(context)

  let action: ToastAction | undefined

  if (actions.length > 0) {
    const primaryAction = actions[0]
    action = {
      label: getActionLabel(primaryAction),
      onClick: () => {
        const result = executeRecoveryAction(primaryAction, context, callbacks || {})
        if (result instanceof Promise) {
          result.catch(() => {
            // Error handling is done in the callback
          })
        }
      },
    }
  }

  const description = getRecoveryDescription(context)

  return toast.show({
    id: toastId,
    message: `${context.type} transaction pending`,
    description,
    variant: "transaction-progress",
    duration: 0,
    persistent: true,
    action,
  })
}

export function showTransactionTerminalToast(
  toastId: string,
  success: boolean,
  message: string,
  context: TransactionRecoveryContext,
  callbacks?: { onRetry?: () => Promise<void> }
): string {
  const action = success ? undefined : {
    label: "Retry",
    onClick: () => {
      callbacks?.onRetry?.().catch(() => {
        // Error handling is done in the callback
      })
    },
  }

  const description = context.txHash
    ? `View on Stellar Expert to verify`
    : "Transaction details will appear shortly"

  return toast.show({
    id: toastId,
    message,
    description,
    variant: success ? "success" : "error",
    duration: success ? 4000 : 6000,
    isTerminal: true,
    persistent: false,
    action: !success ? action : undefined,
  })
}

function getActionLabel(action: string): string {
  switch (action) {
    case "retry":
      return "Retry"
    case "cancel":
      return "Cancel Order"
    case "view-explorer":
      return "View on Explorer"
    case "view-account":
      return "View Account"
    default:
      return "Action"
  }
}

function getRecoveryDescription(context: TransactionRecoveryContext): string {
  switch (context.type) {
    case "order":
      return "Submitting your order to the blockchain..."
    case "swap":
      return "Processing your token swap..."
    case "liquidity-pool":
      return "Adding liquidity to the pool..."
    default:
      return "Processing your transaction..."
  }
}
