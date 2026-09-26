import { MARKETS } from "../data/markets"
import {
  encodeExecutionFeeXlm,
  encodeOraclePrice,
  encodeUsdAmount,
  toCreateOrderParams,
  toDecreaseOrderParams,
  toSwapOrderParams,
} from "./order-encoding"
import { activeQueryNetwork } from "./query-keys"
import { registerPendingOrder } from "./pending-orders"
import {
  foldAmendReplaceOutcome,
  resolveAmendReplaceSteps,
  validateAmendPayload,
  type AmendPayload,
  type AmendReplaceOutcome,
} from "./order-amendment"
import type { CreateOrderParams, OrderKey } from "@/lib/contracts"
import type { OrderType } from "../hooks/useOrders"
import { NETWORK } from "@/app/config/network"
import { getQueryClient } from "@/app/providers/QueryProvider"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import {
  buildBatchOrderTransaction,
  buildCancelOrderTransaction,
  buildClaimFundingFeesTransaction,
  buildCreateOrderTransaction,
  parseSorobanError,
} from "@/lib/contracts"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import { formatUsd } from "@/shared/lib/format"
import { submitTx } from "@/shared/hooks/useTxSubmit"
import { invalidateMutationOutcome } from "@/shared/lib/mutation-invalidation"
import { validateExecutionRequest } from "./execution-support"

const CHAIN_ID = activeQueryNetwork()

/**
 * Remember a confirmed order locally until the indexer serves it.
 *
 * OB-082: without this, the gap between "transaction confirmed" and "indexer
 * caught up" renders as an empty orders table over a real order.
 */
function trackPendingOrder(
  account: string,
  input: {
    marketAddress: string
    orderType: OrderType
    isLong: boolean
    sizeUsd: number
    triggerPrice?: number
  },
  hash: string,
): void {
  registerPendingOrder(account, {
    marketAddress: input.marketAddress,
    marketName: MARKETS.find((m) => m.address === input.marketAddress)?.name,
    orderType: input.orderType,
    isLong: input.isLong,
    sizeUsd: input.sizeUsd,
    triggerPrice: input.triggerPrice,
    txHash: hash,
  })
}

// ── Parameter types ───────────────────────────────────────────────────────────

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
  sizeDeltaUsdRaw?: bigint
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

export type SidecarOrderParams = {
  account: string
  marketAddress: string
  collateralToken: string
  isLong: boolean
  type: "takeProfit" | "stopLoss"
  /** Trigger price in USD. */
  triggerPrice: number
  /** Size of the parent position in USD — sidecar closes sizePct% of this. */
  parentSizeUsd: number
  /** 0–100 — percentage of parent position to close. */
  sizePct: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidAccount(account: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(account)
}

async function refreshMutation(
  action: Parameters<typeof invalidateMutationOutcome>[1],
  account: string,
  marketAddress?: string,
): Promise<void> {
  await invalidateMutationOutcome(getQueryClient(), action, {
    account,
    network: CHAIN_ID,
    marketAddress,
  })
}

function isDecreaseOrder(
  params: IncreaseOrderParams | DecreaseOrderParams,
): params is DecreaseOrderParams {
  return "positionKey" in params
}

// ── Trade writes ──────────────────────────────────────────────────────────────

export async function createIncreaseOrder(params: IncreaseOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  return submitTx(
    async () => {
      const tx = await buildCreateOrderTransaction(params.account, toCreateOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Opening ${params.isLong ? "Long" : "Short"} ${params.marketAddress}...`,
      successMessage: `${params.isLong ? "Long" : "Short"} order submitted! Size: ${formatUsd(params.sizeDeltaUsd)}`,
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: (hash) => {
        trackPendingOrder(
          params.account,
          {
            marketAddress: params.marketAddress,
            orderType: params.orderType,
            isLong: params.isLong,
            sizeUsd: params.sizeDeltaUsd,
            triggerPrice: params.triggerPrice,
          },
          hash,
        )
        return refreshMutation("create", params.account, params.marketAddress)
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
      const tx = await buildCreateOrderTransaction(params.account, toDecreaseOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Closing ${params.isLong ? "Long" : "Short"} ${params.marketAddress}...`,
      successMessage: "Close order submitted",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () =>
        refreshMutation("create", params.account, params.marketAddress),
      onError: parseSorobanError,
    },
  )
}

export async function createSwapOrder(params: SwapOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing an order.")
  }

  const knownMarkets = new Set(MARKETS.map((m) => m.address))
  const invalidPools = params.swapPath.filter((a) => !knownMarkets.has(a))
  if (invalidPools.length > 0) {
    throw new Error(`Invalid swap path: unknown pool(s): ${invalidPools.join(", ")}`)
  }

  return submitTx(
    async () => {
      // Swap uses create_order with MarketSwap type — no separate endpoint.
      const tx = await buildCreateOrderTransaction(params.account, toSwapOrderParams(params))
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Swapping ${params.fromToken} → ${params.toToken}...`,
      successMessage: "Swap submitted",
      successDescription: (hash) =>
        `${params.amountIn} ${params.fromToken} → ${params.minAmountOut} ${params.toToken} | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => refreshMutation("create", params.account),
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
      onSuccess: () => refreshMutation("cancel", account),
      onError: parseSorobanError,
    },
  )
}

export type AmendOrderTarget = {
  orderKey: OrderKey
  marketAddress: string
  collateralToken: string
  orderType: OrderType
  isLong: boolean
  acceptablePrice: number
  triggerPrice: number
  positionKey: string | null
  /** Current remaining (unfilled) size in USD — re-read immediately before submitting. */
  remainingSizeUsd: number
  filledSizeUsd: number
  stage: "accepted" | "partially-filled" | "pending" | "frozen" | "pending-cancellation" | "filled" | "cancelled"
  awaitingIndex?: boolean
}

/**
 * Amend an order via cancel-and-replace as two separate consequential steps
 * (OB-084). The venue has no in-place update, so the replacement loses queue
 * priority. If cancellation succeeds but the replacement fails, the outcome is
 * `replace-failed` with `originalGone: true` — callers must never present the
 * original order as still live in that case.
 */
export async function amendOrderViaReplace(
  account: string,
  original: AmendOrderTarget,
  payload: AmendPayload,
): Promise<AmendReplaceOutcome> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before amending an order.")
  }

  const validationError = validateAmendPayload(payload, {
    orderType: original.orderType,
    stage: original.stage,
    awaitingIndex: original.awaitingIndex,
    currentTriggerPrice: original.triggerPrice,
    remainingSizeUsd: original.remainingSizeUsd,
  })
  if (validationError) throw new Error(validationError)

  const [cancelStep, createStep] = resolveAmendReplaceSteps(
    {
      orderKey: original.orderKey,
      account,
      marketAddress: original.marketAddress,
      collateralToken: original.collateralToken,
      orderType: original.orderType,
      isLong: original.isLong,
      acceptablePrice: original.acceptablePrice,
      originalTriggerPrice: original.triggerPrice,
      positionKey: original.positionKey,
      payload,
    },
    original.remainingSizeUsd,
  )

  if (cancelStep.kind !== "cancel" || createStep.kind !== "create") {
    throw new Error("Amendment failed to resolve cancel-and-replace steps.")
  }

  let cancelTxHash: string
  try {
    cancelTxHash = await submitTx(
      async () => {
        const tx = await buildCancelOrderTransaction(account, cancelStep.orderKey)
        return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
      },
      {
        loadingMessage: "Cancelling order for replacement...",
        successMessage: "Original order cancelled — creating replacement...",
        successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
        onError: parseSorobanError,
      },
    )
  } catch (error) {
    return foldAmendReplaceOutcome({
      cancelError: error instanceof Error ? error.message : "Cancellation failed",
    })
  }

  try {
    const createTxHash = await submitTx(
      async () => {
        const tx = await buildCreateOrderTransaction(account, {
          receiver: account,
          market: createStep.marketAddress,
          initialCollateralToken: original.collateralToken,
          swapPath: [],
          sizeDeltaUsd: encodeUsdAmount(createStep.sizeUsd),
          collateralDeltaAmount: 0n,
          triggerPrice:
            createStep.triggerPrice !== undefined ? encodeOraclePrice(createStep.triggerPrice) : 0n,
          acceptablePrice: encodeOraclePrice(createStep.acceptablePrice),
          executionFee: encodeExecutionFeeXlm(),
          minOutputAmount: 0n,
          orderType: createStep.orderType,
          isLong: createStep.isLong,
        })
        return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
      },
      {
        loadingMessage: "Creating replacement order...",
        successMessage: "Replacement order submitted (back of queue)",
        successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
        onSuccess: (hash) => {
          trackPendingOrder(
            account,
            {
              marketAddress: createStep.marketAddress,
              orderType: createStep.orderType,
              isLong: createStep.isLong,
              sizeUsd: createStep.sizeUsd,
              triggerPrice: createStep.triggerPrice,
            },
            hash,
          )
          return invalidateTradeQueries(account)
        },
        onError: parseSorobanError,
      },
    )
    await queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(CHAIN_ID, account) })
    return foldAmendReplaceOutcome({ cancelTxHash, createTxHash })
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.trade.orders(CHAIN_ID, account) })
    return foldAmendReplaceOutcome({
      cancelTxHash,
      createError: error instanceof Error ? error.message : "Replacement order failed",
    })
  }
}

export async function claimFundingFees(
  account: string,
  marketAddresses: Array<string>,
  /** Collateral token addresses parallel to marketAddresses. */
  tokens: Array<string>,
): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before claiming funding fees.")
  }

  return submitTx(
    async () => {
      const tx = await buildClaimFundingFeesTransaction(account, marketAddresses, tokens)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Claiming funding fees for ${marketAddresses.length} market(s)...`,
      successMessage: "Funding fees claimed",
      successDescription: (hash) =>
        `${marketAddresses.length} market(s) | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => void refreshMutation("claim", account),
      onError: parseSorobanError,
    },
  )
}

export async function sendBatchOrderTxn(
  account: string,
  params: {
    createOrders?: Array<IncreaseOrderParams | DecreaseOrderParams>
    cancelOrderKeys?: Array<OrderKey>
  },
): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before submitting a batch order.")
  }

  const opCount =
    (params.createOrders?.length ?? 0) + (params.cancelOrderKeys?.length ?? 0)
  if (opCount === 0) throw new Error("Batch must contain at least one operation.")

  return submitTx(
    async () => {
      const operations: Parameters<typeof buildBatchOrderTransaction>[1] = [
        ...(params.createOrders ?? []).map((p) => ({
          type: "createOrder" as const,
          params: isDecreaseOrder(p) ? toDecreaseOrderParams(p) : toCreateOrderParams(p),
        })),
        ...(params.cancelOrderKeys ?? []).map((key) => ({
          type: "cancelOrder" as const,
          key,
        })),
      ]

      const tx = await buildBatchOrderTransaction(account, operations)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Submitting batch (${opCount} operations)...`,
      successMessage: "Batch order submitted",
      successDescription: (hash) => `${opCount} operations | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: async () => {
        await Promise.all([
          refreshMutation("create", account),
          refreshMutation("cancel", account),
        ])
      },
      onError: parseSorobanError,
    },
  )
}

/**
 * Kept as a defensive boundary for callers that still hold an old sidecar
 * draft. The current gateway does not verify attached TP/SL semantics.
 */
export async function createSidecarOrder(params: SidecarOrderParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before placing a TP/SL order.")
  }

  const support = validateExecutionRequest({
    attachedOrders: [{
      type: params.type,
      triggerPrice: String(params.triggerPrice),
      sizePct: params.sizePct,
    }],
  })
  if (!support.valid) throw new Error(support.reason)

  const sizeDeltaUsd = params.parentSizeUsd * (params.sizePct / 100)
  const orderType: CreateOrderParams["orderType"] =
    params.type === "takeProfit" ? "LimitDecrease" : "StopLossDecrease"
  const triggerPrice = encodeOraclePrice(params.triggerPrice)

  // Slippage: ±0.5% around trigger for the acceptable price
  const slippage = 0.005
  const acceptablePrice = encodeOraclePrice(
    params.isLong
      ? params.triggerPrice * (1 - slippage)   // long TP/SL — acceptable is below trigger
      : params.triggerPrice * (1 + slippage),  // short TP/SL — acceptable is above trigger
  )

  return submitTx(
    async () => {
      const contractParams: CreateOrderParams = {
        receiver:               params.account,
        market:                 params.marketAddress,
        initialCollateralToken: params.collateralToken,
        swapPath:               [] as Array<string>,
        sizeDeltaUsd:           encodeUsdAmount(sizeDeltaUsd),
        collateralDeltaAmount:  0n,
        triggerPrice,
        acceptablePrice,
        executionFee:           encodeExecutionFeeXlm(),
        minOutputAmount:        0n,
        orderType:              orderType,
        isLong:                 params.isLong,
      }
      const tx = await buildCreateOrderTransaction(params.account, contractParams)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Setting ${params.type === "takeProfit" ? "Take Profit" : "Stop Loss"}...`,
      successMessage: `${params.type === "takeProfit" ? "Take Profit" : "Stop Loss"} order set`,
      successDescription: (hash) => `Trigger: $${params.triggerPrice.toLocaleString()} | Tx: ${hash.slice(0, 8)}...`,
      onSuccess: (hash) => {
        trackPendingOrder(
          params.account,
          {
            marketAddress: params.marketAddress,
            orderType:
              params.type === "takeProfit" ? "LimitDecrease" : "StopLossDecrease",
            isLong: params.isLong,
            sizeUsd: sizeDeltaUsd,
            triggerPrice: params.triggerPrice,
          },
          hash,
        )
        return refreshMutation("create", params.account, params.marketAddress)
      },
      onError: parseSorobanError,
    },
  )
}
