/**
 * Enhanced orders hook backed by indexer lifecycle data with a contract-read
 * fallback and confirmed-but-not-yet-indexed pending rows.
 */

import { reconcilePendingOrders, toKnownOrderType } from "../lib/order-lifecycle"
import { toTimestampMillis } from "../lib/order-history"
import { usePendingOrders } from "../lib/pending-orders"
import { useAccountOrders } from "./useAccountOrders"
import { useOrders } from "./useOrders"
import type { Order as ContractOrder, OrderType } from "./useOrders"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export type OrderWithIndexer = ContractOrder & {
  /** Stable identity that survives the indexer assigning a real key. */
  clientOrderId: string
  /** True while a confirmed order has not appeared in indexed data yet. */
  awaitingIndex: boolean
  /** Whether the trigger field is a limit price, a trigger price, or unused. */
  limitOrTrigger: "market" | "limit" | "trigger"
  positionKey: string | null
  createdAt: number | null
  frozenTimestamp?: Date | null
  frozenTransactionHash?: string | null
  executedTimestamp?: Date | null
  executedTransactionHash?: string | null
  cancelledTimestamp?: Date | null
  cancelledTransactionHash?: string | null
  cancellationReason?: string | null
}

const USD_DECIMALS = 30

function toUsd(raw: string | null | undefined): number {
  if (!raw) return 0
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed / 10 ** USD_DECIMALS : 0
}

function describeTrigger(
  orderType: OrderType,
  triggerPrice: number,
): "market" | "limit" | "trigger" {
  if (orderType.startsWith("Limit")) return "limit"
  if (orderType.startsWith("StopLoss") || triggerPrice > 0) return "trigger"
  return "market"
}

function contractFallback(order: ContractOrder): OrderWithIndexer {
  return {
    ...order,
    clientOrderId: order.key,
    awaitingIndex: false,
    limitOrTrigger: describeTrigger(order.orderType, order.triggerPrice),
    positionKey: null,
    createdAt: order.updatedAt,
  }
}

/** Open lifecycle statuses — everything the resting-order table may show. */
const OPEN_STATUSES: ReadonlySet<string> = new Set([
  "created",
  "updated",
  "frozen",
])

export function useOrdersWithIndexer() {
  const account = useWalletStore((state) => state.address)
  const {
    data: indexedOrders = [],
    isLoading: isLoadingIndexer,
    isDisabled,
  } = useAccountOrders(account)
  const {
    data: contractOrders = [],
    isLoading: isLoadingContract,
  } = useOrders()
  const pendingOrders = usePendingOrders(account)

  if (isDisabled || !INDEXER_CONFIG.enabled) {
    return {
      data: contractOrders.map(contractFallback),
      isLoading: isLoadingContract,
      isDisabled: true,
    }
  }

  const enhancedOrders: Array<OrderWithIndexer> = indexedOrders
    .filter((order) => OPEN_STATUSES.has(order.status.trim().toLowerCase()))
    .map((indexedOrder) => {
      const orderType = toKnownOrderType(indexedOrder.orderType)
      const sizeUsd = toUsd(indexedOrder.sizeDeltaUsd)
      const triggerPrice = toUsd(indexedOrder.triggerPrice)
      const createdAt = toTimestampMillis(indexedOrder.createdTimestamp)

      return {
        key: indexedOrder.key,
        clientOrderId: indexedOrder.key,
        account: indexedOrder.account,
        marketAddress: indexedOrder.market.key,
        marketName: indexedOrder.market.name ?? indexedOrder.market.key,
        collateralToken: indexedOrder.collateralToken?.address ?? "",
        orderType,
        status:
          indexedOrder.status.trim().toLowerCase() === "frozen"
            ? "frozen"
            : "active",
        isLong: indexedOrder.isLong ?? false,
        sizeUsd,
        triggerPrice,
        acceptablePrice: toUsd(indexedOrder.acceptablePrice),
        updatedAt:
          toTimestampMillis(indexedOrder.updatedTimestamp) ??
          createdAt ??
          Date.now(),
        awaitingIndex: false,
        limitOrTrigger: describeTrigger(orderType, triggerPrice),
        positionKey: indexedOrder.positionKey,
        createdAt,
        frozenTimestamp: indexedOrder.frozenTimestamp,
        frozenTransactionHash: indexedOrder.frozenTransactionHash,
        executedTimestamp: indexedOrder.executedTimestamp,
        executedTransactionHash: indexedOrder.executedTransactionHash,
        cancelledTimestamp: indexedOrder.cancelledTimestamp,
        cancelledTransactionHash: indexedOrder.cancelledTransactionHash,
        cancellationReason: indexedOrder.cancellationReason,
      }
    })

  const unresolvedIds = new Set(
    reconcilePendingOrders(pendingOrders, enhancedOrders).map(
      (pending) => pending.clientOrderId,
    ),
  )
  const awaitingIndex = pendingOrders.filter((pending) =>
    unresolvedIds.has(pending.clientOrderId),
  )

  const pendingRows: Array<OrderWithIndexer> = awaitingIndex.map((pending) => ({
    key: "",
    clientOrderId: pending.clientOrderId,
    account: pending.account,
    marketAddress: pending.marketAddress,
    marketName: pending.marketName,
    collateralToken: "",
    orderType: pending.orderType,
    status: "active",
    isLong: pending.isLong,
    sizeUsd: pending.sizeUsd,
    triggerPrice: pending.triggerPrice,
    acceptablePrice: 0,
    updatedAt: pending.submittedAt,
    awaitingIndex: true,
    limitOrTrigger: describeTrigger(pending.orderType, pending.triggerPrice),
    positionKey: null,
    createdAt: pending.submittedAt,
  }))

  return {
    data: [...pendingRows, ...enhancedOrders],
    isLoading: isLoadingIndexer,
    isDisabled: false,
  }
}
