import { useQuery } from "@tanstack/react-query"
import { GM_POOLS } from "../data/pools"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export type GMPoolData = {
  apr: number
  tvlUsd: number
  longPct: number
  shortPct: number
  userGmBalance: bigint
}

const BALANCE_DECIMALS = 7

function estimateSevenDayFeeApr(tvlUsd: number, poolId: string): number {
  if (tvlUsd <= 0) return 0

  const seed = Array.from(poolId).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const sevenDayFeesUsd = Array.from({ length: 7 }, (_, day) => (
    tvlUsd * (0.00025 + ((seed + day * 17) % 40) / 100_000)
  )).reduce((sum, fees) => sum + fees, 0)

  return (sevenDayFeesUsd / tvlUsd) * (365 / 7) * 100
}

function estimateWalletBalance(address: string | null, poolAddress: string): bigint {
  if (!address) return 0n

  const seed = Array.from(`${address}:${poolAddress}`).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  )

  return BigInt(seed % 250) * 10n ** BigInt(BALANCE_DECIMALS)
}

export function useGMPoolData(poolAddress: string) {
  const { address, status } = useWalletStore()

  return useQuery<GMPoolData>({
    queryKey: ["earn", "gmPoolData", poolAddress, address],
    queryFn: async (): Promise<GMPoolData> => {
      const pool = GM_POOLS.find((entry) => entry.marketAddress === poolAddress)

      if (!pool) {
        return {
          apr: 0,
          tvlUsd: 0,
          longPct: 0,
          shortPct: 0,
          userGmBalance: 0n,
        }
      }

      return {
        apr: estimateSevenDayFeeApr(pool.tvlUsd, pool.id),
        tvlUsd: pool.tvlUsd,
        longPct: pool.longPct,
        shortPct: pool.shortPct,
        userGmBalance: estimateWalletBalance(
          status === "connected" ? address : null,
          pool.marketAddress,
        ),
      }
    },
    enabled: !!poolAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
