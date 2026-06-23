import { useQuery } from "@tanstack/react-query"
import { fetchTokenPrices } from "../lib/oracle"
import { queryKeys } from "../lib/query-keys"
import { getOracleStaleness } from "../lib/pyth"
import { useTokenList } from "./useTokenList"
import type { TokenPrice } from "../lib/oracle"
import type { OracleStaleness } from "../lib/pyth"

const CHAIN_ID = "stellar-mainnet"

// Maps our test token symbols to base symbols that fetchTokenPrices uses as keys
const TEST_TO_BASE: Record<string, string> = {
  TWBTC: "BTC", TETH: "ETH", TXLM: "XLM", TUSDC: "USDC",
}

type PricesMap = Record<string, TokenPrice>

export function useTokenPrices() {
  const { getToken } = useTokenList()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tokenPrices(CHAIN_ID),
    queryFn: fetchTokenPrices,
    staleTime: 3_000,
    refetchInterval: 5_000,
    select(prices): PricesMap {
      return Object.fromEntries(prices.map((p) => [p.symbol, p]))
    },
  })

  // Resolves a contract address or test symbol (TWBTC) → base symbol (BTC)
  const resolveSymbol = (addressOrSymbol: string): string => {
    const token = getToken(addressOrSymbol)
    const tokenSymbol = token ? token.symbol : addressOrSymbol
    return TEST_TO_BASE[tokenSymbol] ?? tokenSymbol
  }

  return {
    prices: data ?? {},
    isLoading,
    error,
    getPrice: (addressOrSymbol: string): TokenPrice | undefined => {
      const symbol = resolveSymbol(addressOrSymbol)
      return data?.[symbol]
    },
    getMidPrice: (addressOrSymbol: string): number => {
      const symbol = resolveSymbol(addressOrSymbol)
      const p = data?.[symbol]
      if (!p) return 0
      return (p.minPrice + p.maxPrice) / 2
    },
    getStaleness: (addressOrSymbol: string): OracleStaleness => {
      const symbol = resolveSymbol(addressOrSymbol)
      const p = data?.[symbol]
      if (!p) return "stale"
      return getOracleStaleness(p.updatedAt)
    },
    isStale: (addressOrSymbol: string): boolean => {
      return getOracleStaleness(data?.[resolveSymbol(addressOrSymbol)]?.updatedAt ?? 0) === "stale"
    },
  }
}
