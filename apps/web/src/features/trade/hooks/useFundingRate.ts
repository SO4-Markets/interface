import { useQuery } from "@tanstack/react-query"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { syntheticsReaderClient } from "@/lib/contracts"

const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000 // 8-hour epochs
const CHAIN_ID = activeQueryNetwork()
const DEFAULT_MARKET_ADDRESS = "all"
const SECONDS_PER_HOUR = 3600n
const FACTOR_PRECISION = 10n ** 30n

export type FundingRateInfo = {
  ratePerHour: number
  nextEpochTs: number // Unix ms timestamp of next funding settlement
}

function computeNextEpoch(): number {
  const now = Date.now()
  const elapsed = now % FUNDING_INTERVAL_MS
  return now - elapsed + FUNDING_INTERVAL_MS
}

async function fetchFundingRate(marketAddress: string): Promise<FundingRateInfo> {
  if (marketAddress === DEFAULT_MARKET_ADDRESS) {
    return { ratePerHour: 0, nextEpochTs: computeNextEpoch() }
  }

  const reader = syntheticsReaderClient
  const info = await reader.getFundingInfo(marketAddress)

  // funding_factor_per_second is in 30-decimal precision.
  // per-hour rate (fractional) = factor_per_second × 3600 / 10^30
  const perHourFactor = info.fundingFactorPerSecond * SECONDS_PER_HOUR
  const ratePerHour = Number(perHourFactor) / Number(FACTOR_PRECISION)

  return { ratePerHour, nextEpochTs: computeNextEpoch() }
}

// Market token addresses in the MARKETS data may be placeholders (e.g. "BTC-BTC-USDC")
// until real Soroban contract addresses are configured. Guard all on-chain calls.
function isSorobanAddress(addr: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(addr)
}

export function useFundingRate(marketAddress: string = DEFAULT_MARKET_ADDRESS) {
  return useQuery<FundingRateInfo>({
    queryKey: queryKeys.trade.fundingRate(CHAIN_ID, marketAddress),
    queryFn: () => fetchFundingRate(marketAddress),
    enabled: marketAddress !== DEFAULT_MARKET_ADDRESS && isSorobanAddress(marketAddress),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
