import { useQuery } from "@tanstack/react-query"
import { fetchOracleCandles } from "../lib/oracle"
import { queryKeys } from "../lib/query-keys"
import type { CandleResponse } from "../lib/oracle"

export function useOracleCandles(symbol: string | undefined, period: string) {
  return useQuery<CandleResponse>({
    queryKey: queryKeys.trade.oracleCandles(symbol ?? "", period),
    queryFn: ({ signal }) => fetchOracleCandles(symbol!, period, 500, signal),
    enabled: !!symbol,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      const previousSymbol = previousQuery?.queryKey[1]
      if (previousSymbol && previousSymbol === symbol) {
        return previousData
      }
      return undefined
    },
  })
}
