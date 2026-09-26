/**
 * Generates explorer links for transactions and provides recovery utilities
 */

const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/public"

export type ExplorerNetwork = "mainnet" | "testnet" | "public"

export function getStellarExpertLink(
  txHash: string,
  network: ExplorerNetwork = "public"
): string {
  return `${STELLAR_EXPERT_BASE}/${network}/tx/${txHash}`
}

export function getAccountExplorerLink(
  account: string,
  network: ExplorerNetwork = "public"
): string {
  return `${STELLAR_EXPERT_BASE}/${network}/account/${account}`
}

export type TransactionRecoveryAction =
  | "retry"
  | "cancel"
  | "view-explorer"
  | "view-account"

export interface TransactionRecoveryContext {
  txHash?: string
  account?: string
  type: "order" | "swap" | "liquidity-pool"
  canRetry: boolean
  canCancel: boolean
}

export function getRecoveryActions(context: TransactionRecoveryContext): TransactionRecoveryAction[] {
  const actions: TransactionRecoveryAction[] = []

  if (context.canRetry) actions.push("retry")
  if (context.canCancel) actions.push("cancel")
  if (context.txHash) actions.push("view-explorer")
  if (context.account) actions.push("view-account")

  return actions
}

export function executeRecoveryAction(
  action: TransactionRecoveryAction,
  context: TransactionRecoveryContext,
  callbacks: {
    onRetry?: () => Promise<void>
    onCancel?: () => Promise<void>
  }
): void | Promise<void> {
  switch (action) {
    case "retry":
      return callbacks.onRetry?.()
    case "cancel":
      return callbacks.onCancel?.()
    case "view-explorer":
      if (context.txHash) {
        window.open(getStellarExpertLink(context.txHash), "_blank")
      }
      break
    case "view-account":
      if (context.account) {
        window.open(getAccountExplorerLink(context.account), "_blank")
      }
      break
  }
}
