import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { fetchOracleCandles } from "../lib/oracle"
import { queryKeys } from "../lib/query-keys"
import type { OhlcBar } from "../lib/oracle"

export function useOracleCandles(symbol: string | undefined, period: string) {
  return useQuery<Array<OhlcBar>>({
    queryKey: queryKeys.trade.oracleCandles(symbol ?? "", period),
    queryFn: ({ signal }) => fetchOracleCandles(symbol!, period, 500, signal),
    enabled: !!symbol,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      // Only keep previous data if we are switching timeframes for the SAME market
      const previousSymbol = previousQuery?.queryKey[1]
      if (previousSymbol && previousSymbol === symbol) {
        return previousData
      }
      return undefined
    },
  })
}
