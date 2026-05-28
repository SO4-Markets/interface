import { formatUsd } from "@/shared/lib/format"
import { explorerTxUrl, NETWORK } from "@/app/config/network"
import { queryClient } from "@/app/providers/QueryProvider"
import { MARKETS } from "../data/markets"
import {
  buildCreateOrderTransaction,
  buildCancelOrderTransaction,
  buildSwapOrderTransaction,
  buildBatchOrderTransaction,
  buildClaimFundingFeesTransaction,
} from "@/lib/contracts/exchange-router-client"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import { parseSorobanError } from "@/lib/soroban/errors"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { queryKeys } from "./query-keys"
import { toCreateOrderParams, toDecreaseOrderParams, toSwapOrderParams } from "./order-encoding"
import type { OrderKey, BatchOperation } from "@/lib/contracts/generated/exchange-router/src"
import { submitTx } from "@/shared/hooks/useTxSubmit"

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

export async function createIncreaseOrder(params: IncreaseOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  return submitTx(
    async () => {
      const tx = await buildCreateOrderTransaction(toCreateOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Opening ${params.isLong ? "Long" : "Short"} ${params.marketAddress}...`,
      successMessage: `${params.isLong ? "Long" : "Short"} order submitted! Size: ${formatUsd(params.sizeDeltaUsd)}`,
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: (hash) => {
        void invalidateTradeQueries(params.account)
        window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer")
      },
      onError: parseSorobanError,
    },
  )
}

export async function createDecreaseOrder(params: DecreaseOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  return submitTx(
    async () => {
      const tx = await buildCreateOrderTransaction(toDecreaseOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Closing ${params.isLong ? "Long" : "Short"} ${params.marketAddress}...`,
      successMessage: "Position closed successfully",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.positions(CHAIN_ID, params.account) }),
      onError: parseSorobanError,
    },
  )
}

export async function createSwapOrder(params: SwapOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  const knownMarketAddresses = new Set(MARKETS.map((m) => m.address))
  const invalidPools = params.swapPath.filter((addr) => !knownMarketAddresses.has(addr))
  if (invalidPools.length > 0) {
    throw new Error(`Invalid swap path: unknown pool address(es): ${invalidPools.join(", ")}`)
  }

  return submitTx(
    async () => {
      const tx = await buildSwapOrderTransaction(toSwapOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Swapping ${params.fromToken} -> ${params.toToken}...`,
      successMessage: "Swap submitted",
      successDescription: (hash) =>
        `${params.amountIn} ${params.fromToken} -> ${params.minAmountOut} ${params.toToken} | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.tokenBalances(CHAIN_ID, params.account),
        }),
      onError: parseSorobanError,
    },
  )
}

export async function cancelOrder(account: string, orderKey: OrderKey): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before cancelling an order.")
  }

  return submitTx(
    async () => {
      const tx = await buildCancelOrderTransaction(account, orderKey)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: "Cancelling order...",
      successMessage: "Order cancelled",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders(CHAIN_ID, account) }),
      onError: parseSorobanError,
    },
  )
}

export async function claimFundingFees(account: string, marketAddresses: Array<string>): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before claiming funding fees.")
  }

  return submitTx(
    async () => {
      const tx = await buildClaimFundingFeesTransaction(account, marketAddresses)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Claiming funding fees for ${marketAddresses.length} market(s)...`,
      successMessage: "Funding fees claimed",
      successDescription: (hash) => `${marketAddresses.length} market(s) | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: (hash) => {
        void invalidateTradeQueries(account)
        window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer")
      },
      onError: parseSorobanError,
    },
  )
}

export type BatchOrderParams = {
  createOrders?: Array<IncreaseOrderParams | DecreaseOrderParams>
  cancelOrderKeys?: Array<OrderKey>
}

function isDecreaseOrder(
  params: IncreaseOrderParams | DecreaseOrderParams,
): params is DecreaseOrderParams {
  return "positionKey" in params
}

export async function sendBatchOrderTxn(account: string, params: BatchOrderParams): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before submitting a batch order.")
  }

  const opCount = (params.createOrders?.length ?? 0) + (params.cancelOrderKeys?.length ?? 0)
  if (opCount === 0) {
    throw new Error("Batch order must contain at least one operation.")
  }

  return submitTx(
    async () => {
      const operations: Array<BatchOperation> = [
        ...(params.createOrders ?? []).map((p) => ({
          actionType: "createOrder" as const,
          orderParams: isDecreaseOrder(p) ? toDecreaseOrderParams(p) : toCreateOrderParams(p),
          cancelKey: null,
        })),
        ...(params.cancelOrderKeys ?? []).map((key) => ({
          actionType: "cancelOrder" as const,
          orderParams: null,
          cancelKey: key,
        })),
      ]

      const tx = await buildBatchOrderTransaction(account, operations)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Submitting batch (${opCount} operations)...`,
      successMessage: "Batch order submitted",
      successDescription: (hash) => `${opCount} operations | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: (hash) => {
        void invalidateTradeQueries(account)
        window.open(explorerTxUrl(hash), "_blank", "noopener,noreferrer")
      },
      onError: parseSorobanError,
    },
  )
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

export async function createSidecarOrder(_params: SidecarOrderParams): Promise<string> {
  await fakeTxDelay(900)
  return "DUMMY_TX_HASH"
}

function fakeTxDelay(ms = 1500): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}
