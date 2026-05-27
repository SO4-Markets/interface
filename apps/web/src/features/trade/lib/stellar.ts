// Stellar / Soroban contract interaction layer
//
// Write paths (createIncreaseOrder, etc.) submit real Soroban transactions.
// Remaining stubs still simulate latency until wired in later phase-5 issues.

import { toast } from "sonner"
import { formatUsd } from "@/shared/lib/format"
import { explorerTxUrl, NETWORK } from "@/app/config/network"
import { queryClient } from "@/app/providers/QueryProvider"
import { MARKETS } from "../data/markets"
import {
  buildCreateOrderTransaction,
  buildCancelOrderTransaction,
  buildSwapOrderTransaction,
  buildBatchOrderTransaction,
} from "@/lib/contracts/exchange-router-client"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import { sendAndPoll } from "@/lib/tx-builder"
import { parseSorobanError } from "@/lib/soroban/errors"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { queryKeys } from "./query-keys"
import { toCreateOrderParams, toDecreaseOrderParams, toSwapOrderParams } from "./order-encoding"
import type { OrderKey, BatchOperation } from "@/lib/contracts/generated/exchange-router/src"

const CHAIN_ID = "stellar-mainnet"

export type IncreaseOrderParams = {
  account: string
  marketAddress: string
  collateralToken: string
  collateralAmount: number
  sizeDeltaUsd: number
  isLong: boolean
  acceptablePrice: number
  triggerPrice?: number
  orderType: "MarketIncrease" | "LimitIncrease"
  leverage: number
}

export type DecreaseOrderParams = {
  account: string
  positionKey: string
  marketAddress: string
  collateralToken: string
  collateralDeltaAmount: number
  sizeDeltaUsd: number
  isLong: boolean
  acceptablePrice: number
  triggerPrice?: number
  orderType: "MarketDecrease" | "LimitDecrease" | "StopLoss"
  receiveToken: string
}

export type SwapOrderParams = {
  account: string
  fromToken: string
  toToken: string
  amountIn: number
  minAmountOut: number
  swapPath: Array<string>
}

function isValidAccount(account: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(account)
}

async function invalidateTradeQueries(account: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.positions(CHAIN_ID, account) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.orders(CHAIN_ID, account) }),
  ])
}

/** Open a long or short position */
export async function createIncreaseOrder(params: IncreaseOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  const toastId = toast.loading(
    `Opening ${params.isLong ? "Long" : "Short"} ${params.marketAddress}…`,
  )

  try {
    const contractParams = toCreateOrderParams(params)
    const tx = await buildCreateOrderTransaction(contractParams)
    const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    const { hash } = await sendAndPoll(signedXdr)

    await invalidateTradeQueries(params.account)

    toast.success(
      `${params.isLong ? "Long" : "Short"} order submitted! Size: ${formatUsd(params.sizeDeltaUsd)}`,
      {
        id: toastId,
        description: `Tx: ${hash.slice(0, 8)}…`,
        action: {
          label: "View on Stellar Expert",
          onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer"),
        },
      },
    )

    return hash
  } catch (error) {
    toast.error(parseSorobanError(error), { id: toastId })
    throw error
  }
}

/** Close or reduce an open position */
export async function createDecreaseOrder(params: DecreaseOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  const toastId = toast.loading(
    `Closing ${params.isLong ? "Long" : "Short"} ${params.marketAddress}…`,
  )

  try {
    const contractParams = toDecreaseOrderParams(params)
    const tx = await buildCreateOrderTransaction(contractParams)
    const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    const { hash } = await sendAndPoll(signedXdr)

    await queryClient.invalidateQueries({ queryKey: queryKeys.positions(CHAIN_ID, params.account) })

    toast.success("Position closed successfully", {
      id: toastId,
      description: `Tx: ${hash.slice(0, 8)}…`,
      action: {
        label: "View on Stellar Expert",
        onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer"),
      },
    })

    return hash
  } catch (error) {
    toast.error(parseSorobanError(error), { id: toastId })
    throw error
  }
}

/** Swap one token for another */
export async function createSwapOrder(params: SwapOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  const knownMarketAddresses = new Set(MARKETS.map((m) => m.address))
  const invalidPools = params.swapPath.filter((addr) => !knownMarketAddresses.has(addr))
  if (invalidPools.length > 0) {
    throw new Error(`Invalid swap path: unknown pool address(es): ${invalidPools.join(", ")}`)
  }

  const toastId = toast.loading(`Swapping ${params.fromToken} → ${params.toToken}…`)

  try {
    const contractParams = toSwapOrderParams(params)
    const tx = await buildSwapOrderTransaction(contractParams)
    const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    const { hash } = await sendAndPoll(signedXdr)

    await queryClient.invalidateQueries({
      queryKey: queryKeys.tokenBalances(CHAIN_ID, params.account),
    })

    toast.success(`Swap submitted`, {
      id: toastId,
      description: `${params.amountIn} ${params.fromToken} → ${params.minAmountOut} ${params.toToken} | Tx: ${hash.slice(0, 8)}…`,
      action: {
        label: "View on Stellar Expert",
        onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer"),
      },
    })

    return hash
  } catch (error) {
    toast.error(parseSorobanError(error), { id: toastId })
    throw error
  }
}

/** Cancel a pending limit/trigger order */
export async function cancelOrder(account: string, orderKey: OrderKey): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before cancelling an order.")
  }

  const toastId = toast.loading("Cancelling order…")

  try {
    const tx = await buildCancelOrderTransaction(account, orderKey)
    const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    const { hash } = await sendAndPoll(signedXdr)

    await queryClient.invalidateQueries({ queryKey: queryKeys.orders(CHAIN_ID, account) })

    toast.success("Order cancelled", {
      id: toastId,
      description: `Tx: ${hash.slice(0, 8)}…`,
      action: {
        label: "View on Stellar Expert",
        onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer"),
      },
    })

    return hash
  } catch (error) {
    toast.error(parseSorobanError(error), { id: toastId })
    throw error
  }
}

/** Claim accrued funding fees */
export async function claimFundingFees(
  _account: string,
  marketAddresses: Array<string>,
): Promise<string> {
  const toastId = toast.loading("Claiming funding fees…")
  await fakeTxDelay(1000)

  toast.success(`Funding fees claimed for ${marketAddresses.length} market(s)`, {
    id: toastId,
  })
  return "DUMMY_TX_HASH"
}

export type BatchOrderParams = {
  createOrders?: Array<IncreaseOrderParams>
  cancelOrderKeys?: Array<OrderKey>
}

export async function sendBatchOrderTxn(
  account: string,
  params: BatchOrderParams,
): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before submitting a batch order.")
  }

  const opCount = (params.createOrders?.length ?? 0) + (params.cancelOrderKeys?.length ?? 0)
  if (opCount === 0) {
    throw new Error("Batch order must contain at least one operation.")
  }

  const toastId = toast.loading(`Submitting batch (${opCount} operations)…`)

  try {
    const operations: Array<BatchOperation> = [
      ...(params.createOrders ?? []).map((p) => ({
        actionType: "createOrder" as const,
        orderParams: toCreateOrderParams(p),
        cancelKey: null,
      })),
      ...(params.cancelOrderKeys ?? []).map((key) => ({
        actionType: "cancelOrder" as const,
        orderParams: null,
        cancelKey: key,
      })),
    ]

    const tx = await buildBatchOrderTransaction(account, operations)
    const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    const { hash } = await sendAndPoll(signedXdr)

    await invalidateTradeQueries(account)

    toast.success("Batch order submitted", {
      id: toastId,
      description: `${opCount} operations | Tx: ${hash.slice(0, 8)}…`,
      action: {
        label: "View on Stellar Expert",
        onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer"),
      },
    })

    return hash
  } catch (error) {
    toast.error(parseSorobanError(error), { id: toastId })
    throw error
  }
}

export type SidecarOrderParams = {
  account: string
  marketAddress: string
  collateralToken: string
  isLong: boolean
  type: "takeProfit" | "stopLoss"
  triggerPrice: number
  sizePct: number
  indexToken: string
}

export async function createSidecarOrder(params: SidecarOrderParams): Promise<string> {
  const label = params.type === "takeProfit" ? "Take Profit" : "Stop Loss"
  const toastId = toast.loading(`Setting ${label} at ${formatUsd(params.triggerPrice)}…`)
  await fakeTxDelay(900)
  toast.success(`${label} order placed`, { id: toastId, description: "Tx: DUMMY (not real)" })
  return "DUMMY_TX_HASH"
}

function fakeTxDelay(ms = 1500): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}
