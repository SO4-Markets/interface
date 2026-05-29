import { useQuery } from "@tanstack/react-query"
import { fetchCircuitBreakerStatus } from "../lib/data-store"
import { queryKeys } from "../lib/query-keys"

export function useCircuitBreaker(symbol: string | undefined) {
  return useQuery({
    queryKey: queryKeys.circuitBreaker(symbol ?? ""),
    queryFn: () => fetchCircuitBreakerStatus(symbol!),
    enabled: Boolean(symbol),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
