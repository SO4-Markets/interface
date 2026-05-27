import { useQuery } from "@tanstack/react-query"
import {  fetch24hPriceDelta } from "../lib/oracle"
import { queryKeys } from "../lib/query-keys"
import type {PriceDelta24h} from "../lib/oracle";

export function usePriceDelta24h(symbol: string | undefined) {
  return useQuery<PriceDelta24h | null>({
    queryKey: queryKeys.priceDelta24h(symbol ?? ""),
    queryFn: () => fetch24hPriceDelta(symbol!),
    enabled: !!symbol,
    staleTime: 60_000,
  })
}
