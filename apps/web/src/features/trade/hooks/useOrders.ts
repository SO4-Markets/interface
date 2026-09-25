import { useQuery } from "@tanstack/react-query"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { MARKETS } from "../data/markets"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { syntheticsReaderClient } from "@/lib/contracts"
import { fromSorobanAmount } from "@/shared/lib/bignum"

const USD_DECIMALS = 30
const CHAIN_ID = activeQueryNetwork()

export type OrderType =
  | "MarketIncrease"
  | "LimitIncrease"
  | "MarketDecrease"
  | "LimitDecrease"
  | "StopLossDecrease"
  | "MarketSwap"
  | "LimitSwap"

export type OrderStatus = "active" | "frozen"

export type Order = {
  key: string
  account: string
  marketAddress: string
  marketName: string
  collateralToken: string
  sizeUsd: number
  triggerPrice: number
  acceptablePrice: number
  orderType: OrderType
  isLong: boolean
  status: OrderStatus
  updatedAt: number
}

async function fetchOrders(account: string): Promise<Array<Order>> {
  const reader = syntheticsReaderClient
  const [raw, keys] = await Promise.all([
    reader.getAccountOrders(account),
    reader.getAccountOrderKeys(account),
  ])

  return raw.map((o, index): Order => {
    const market = MARKETS.find((m) => m.address === o.market)
    return {
      key: keys[index] ?? "",
      account: o.account,
      marketAddress: o.market,
      marketName: market?.name ?? o.market,
      collateralToken: o.initialCollateralToken,
      sizeUsd: fromSorobanAmount(o.sizeDeltaUsd, USD_DECIMALS),
      triggerPrice: fromSorobanAmount(o.triggerPrice, USD_DECIMALS),
      acceptablePrice: fromSorobanAmount(o.acceptablePrice, USD_DECIMALS),
      orderType: o.orderType as OrderType,
      isLong: o.isLong,
      status: "active",
      updatedAt: Number(o.updatedAtTime) * 1000,
    }
  })
}

export function hasFrozenOrders(orders: Array<Order>): boolean {
  return orders.some((order) => order.status === "frozen")
}

export function useOrders() {
  const account = useWalletStore((state) => state.address)

  return useQuery<Array<Order>>({
    queryKey: queryKeys.trade.orders(CHAIN_ID, account ?? ""),
    queryFn: () => fetchOrders(account!),
    enabled: !!account,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
