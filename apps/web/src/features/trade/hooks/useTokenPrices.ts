import { useQuery } from "@tanstack/react-query"
import {  fetchTokenPrices } from "../lib/oracle"
import { queryKeys } from "../lib/query-keys"
import type {TokenPrice} from "../lib/oracle";

// TODO: Replace "stellar-mainnet" with real chainId from wallet context
const CHAIN_ID = "stellar-mainnet"

type PricesMap = Record<string, TokenPrice>

export function useTokenPrices() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tokenPrices(CHAIN_ID),
    queryFn: fetchTokenPrices,
    staleTime: 3_000,
    refetchInterval: 5_000,
    select(prices): PricesMap {
      return Object.fromEntries(prices.map((p) => [p.symbol, p]))
    },
  })

  return {
    prices: data ?? {},
    isLoading,
    error,
    getPrice: (symbol: string): TokenPrice | undefined => data?.[symbol],
    getMidPrice: (symbol: string): number => {
      const p = data?.[symbol]
      if (!p) return 0
      return (p.minPrice + p.maxPrice) / 2
    },
  }
}
