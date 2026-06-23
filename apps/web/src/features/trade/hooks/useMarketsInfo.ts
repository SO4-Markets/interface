import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../lib/query-keys"
import { useMarkets } from "./useMarkets"
import type { Market } from "./useMarkets"
import { syntheticsReaderClient } from "@/lib/contracts"
import { fromSorobanAmount } from "@/shared/lib/bignum"

export type MarketInfo = Market & {
  openInterestLong: number
  openInterestShort: number
  poolAmount: number
  availableLiquidityLong: number
  availableLiquidityShort: number
  borrowingRatePerHour: number
  fundingRatePerHour: number
  maxLeverage: number
  isDisabled: boolean
}

const CHAIN_ID = "stellar-mainnet"
const USD_DECIMALS = 30
// Reader returns funding_factor_per_second with 30 decimals; multiply by 3600 for per-hour.
const SECONDS_PER_HOUR = 3600n
const FACTOR_PRECISION = 10n ** 30n

function isSorobanAddress(addr: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(addr)
}

async function fetchMarketsInfo(markets: Array<Market>): Promise<Array<MarketInfo>> {
  if (markets.length === 0) return []

  const reader = syntheticsReaderClient

  const results = await Promise.allSettled(
    markets.map(async (m): Promise<MarketInfo> => {
      // Skip on-chain calls for markets that still have placeholder addresses
      const [oi, funding, pool] = isSorobanAddress(m.address)
        ? await Promise.allSettled([
            reader.getOpenInterest(m.address),
            reader.getFundingInfo(m.address),
            reader.getMarketPoolValueInfo(m.address, false),
          ])
        : [
            { status: "rejected" as const, reason: "placeholder address" },
            { status: "rejected" as const, reason: "placeholder address" },
            { status: "rejected" as const, reason: "placeholder address" },
          ]

      const oiData  = oi.status      === "fulfilled" ? oi.value      : null
      const fundingData = funding.status === "fulfilled" ? funding.value : null
      const poolData = pool.status   === "fulfilled" ? pool.value    : null

      const longOI   = oiData   ? fromSorobanAmount(oiData.long,  USD_DECIMALS) : 0
      const shortOI  = oiData   ? fromSorobanAmount(oiData.short, USD_DECIMALS) : 0
      const poolUsd  = poolData ? fromSorobanAmount(poolData.poolValue, USD_DECIMALS) : 0

      // funding_factor_per_second × 3600 / 10^30 → per-hour fractional rate
      let fundingRatePerHour = 0
      if (fundingData && fundingData.fundingFactorPerSecond !== 0n) {
        const perHourFactor = fundingData.fundingFactorPerSecond * SECONDS_PER_HOUR
        fundingRatePerHour = Number(perHourFactor) / Number(FACTOR_PRECISION)
      }

      const availLong  = poolUsd - longOI  > 0 ? poolUsd - longOI  : 0
      const availShort = poolUsd - shortOI > 0 ? poolUsd - shortOI : 0

      return {
        ...m,
        openInterestLong:  longOI,
        openInterestShort: shortOI,
        poolAmount:        poolUsd,
        availableLiquidityLong:  availLong,
        availableLiquidityShort: availShort,
        borrowingRatePerHour: 0.0001, // DataStore read — added in a follow-up
        fundingRatePerHour,
        maxLeverage: 50,              // DataStore read — added in a follow-up
        isDisabled: false,
      }
    }),
  )

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value
    // Contract call failed for this market — return safe zeros so the UI renders
    console.warn(`useMarketsInfo: failed to fetch ${markets[i].address}`, r.reason)
    return {
      ...markets[i],
      openInterestLong: 0,
      openInterestShort: 0,
      poolAmount: 0,
      availableLiquidityLong: 0,
      availableLiquidityShort: 0,
      borrowingRatePerHour: 0,
      fundingRatePerHour: 0,
      maxLeverage: 50,
      isDisabled: false,
    }
  })
}

export function useMarketsInfo() {
  const { markets } = useMarkets()

  const { data, isLoading, error } = useQuery<Array<MarketInfo>>({
    queryKey: queryKeys.trade.marketsInfo(CHAIN_ID),
    queryFn: () => fetchMarketsInfo(markets),
    enabled: markets.length > 0,
    staleTime: 60_000,
  })

  const marketsMap = Object.fromEntries((data ?? []).map((m) => [m.address, m]))

  return {
    marketsInfo: data ?? [],
    marketsMap,
    isLoading,
    error,
    getMarket: (address: string): MarketInfo | undefined => marketsMap[address],
  }
}
