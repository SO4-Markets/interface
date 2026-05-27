import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../lib/query-keys"

export type OrderType =
  | "MarketIncrease"
  | "LimitIncrease"
  | "MarketDecrease"
  | "LimitDecrease"
  | "StopLoss"
  | "Swap"

export type Order = {
  key: string
  account: string
  marketAddress: string
  marketName: string
  indexToken: string
  collateralToken: string
  sizeUsd: number
  triggerPrice: number
  acceptablePrice: number
  orderType: OrderType
  isLong: boolean
  createdAt: number            // unix timestamp ms
  // TODO: Add executionFee, swapPath, decreaseSwapType when live
}

// TODO: Replace with Soroban RPC call: reader.getOrders(account)
async function fetchOrders(account: string): Promise<Array<Order>> {
  if (!account) return []

  return [
    {
      key: `${account}-btc-limit-long`,
      account,
      marketAddress: "BTC-BTC-USDC",
      marketName: "BTC/USD",
      indexToken: "BTC",
      collateralToken: "USDC",
      sizeUsd: 5_000,
      triggerPrice: 65_000,
      acceptablePrice: 65_100,
      orderType: "LimitIncrease",
      isLong: true,
      createdAt: Date.now() - 1000 * 60 * 30,
    },
  ]
}

const DUMMY_ACCOUNT = "GDUMMY...STELLAR"

export function useOrders(account = DUMMY_ACCOUNT) {
  return useQuery<Array<Order>>({
    queryKey: queryKeys.orders("stellar-mainnet", account),
    queryFn: () => fetchOrders(account),
    enabled: !!account,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
