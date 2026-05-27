import { useMemo } from "react"
import { MARKETS } from "../data/markets"
import type { Market } from "../data/markets"
import { useTokenList } from "./useTokenList"

export function useMarkets() {
  const { getToken } = useTokenList()
  const markets = useMemo(() => MARKETS, [])

  const getMarket = useMemo(() => {
    return (address: string) => markets.find((m) => m.address === address)
  }, [markets])

  const getMarketsForIndexToken = useMemo(() => {
    return (indexTokenAddressOrSymbol: string) => {
      const token = getToken(indexTokenAddressOrSymbol)
      const symbol = token ? token.symbol : indexTokenAddressOrSymbol
      return markets.filter((m) => m.indexTokenAddress === symbol)
    }
  }, [markets, getToken])

  return {
    markets,
    getMarket,
    getMarketsForIndexToken,
  }
}

export type { Market }
