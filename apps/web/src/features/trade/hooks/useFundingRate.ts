import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../lib/query-keys"

const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000 // 8-hour epochs

export type FundingRateInfo = {
  ratePerHour: number
  nextEpochTs: number // Unix ms timestamp of next funding settlement
}

function computeNextEpoch(): number {
  const now = Date.now()
  const elapsed = now % FUNDING_INTERVAL_MS
  return now - elapsed + FUNDING_INTERVAL_MS
}

async function fetchFundingRate(): Promise<FundingRateInfo> {
  // TODO: replace with on-chain DataStore read once contracts are deployed
  return {
    ratePerHour: 0.00005,
    nextEpochTs: computeNextEpoch(),
  }
}

export function useFundingRate() {
  return useQuery<FundingRateInfo>({
    queryKey: queryKeys.fundingRate("stellar-mainnet"),
    queryFn: fetchFundingRate,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
