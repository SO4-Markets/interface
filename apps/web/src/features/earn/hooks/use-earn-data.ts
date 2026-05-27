import { useQuery } from "@tanstack/react-query"
import { GLV_VAULTS, GM_POOLS } from "../data/pools"
import { useRewardsAccrued, useStakingInfo } from "../queries"
import { fromSorobanAmount } from "@/shared/lib/bignum"

export type EarnStats = {
  totalInvestmentUsd: number
  totalEarnedUsd: number
  totalPendingRewardsUsd: number
  stakingPowerSharePct: number
}

export type UserGmPosition = {
  poolId: string
  poolName: string
  balanceTokens: number
  balanceUsd: number
  apy: number
}

export type UserGlvPosition = {
  vaultId: string
  vaultName: string
  displayPair: string
  balanceTokens: number
  balanceUsd: number
  apy: number
}

export type UserSO4Stats = {
  walletBalance: number
  stakedAmount: number
  stakedValueUsd: number
  esSO4Balance: number
  multiplierPoints: number
}

export function useEarnStats() {
  const stakingInfo = useStakingInfo()
  const rewardsAccrued = useRewardsAccrued()
  const stakedSO4 = fromSorobanAmount(stakingInfo.data?.stakedSO4 ?? 0n, 7)
  const stakedEsSO4 = fromSorobanAmount(stakingInfo.data?.stakedEsSO4 ?? 0n, 7)
  const pendingEsSO4 = fromSorobanAmount(rewardsAccrued.data?.pendingEsSO4 ?? 0n, 7)
  const pendingWethFees = fromSorobanAmount(rewardsAccrued.data?.pendingWethFees ?? 0n, 7)
  const boostedStake = stakedSO4 + stakedEsSO4 + fromSorobanAmount(stakingInfo.data?.stakedMultiplierPoints ?? 0n, 7)

  return {
    ...stakingInfo,
    data: {
      totalInvestmentUsd: stakedSO4 + stakedEsSO4,
      totalEarnedUsd: 0,
      totalPendingRewardsUsd: pendingEsSO4 + pendingWethFees,
      stakingPowerSharePct: boostedStake > 0 ? 100 : 0,
    } satisfies EarnStats,
    isLoading: stakingInfo.isLoading || rewardsAccrued.isLoading,
  }
}

export function useUserGmPositions() {
  return useQuery<Array<UserGmPosition>>({
    queryKey: ["earn", "gm-positions"],
    queryFn: async (): Promise<Array<UserGmPosition>> => {
      return []
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function useUserGlvPositions() {
  return useQuery<Array<UserGlvPosition>>({
    queryKey: ["earn", "glv-positions"],
    queryFn: async (): Promise<Array<UserGlvPosition>> => {
      return []
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function useUserSO4Stats() {
  const stakingInfo = useStakingInfo()
  const stakedAmount = fromSorobanAmount(stakingInfo.data?.stakedSO4 ?? 0n, 7)

  return {
    ...stakingInfo,
    data: {
      walletBalance: 0,
      stakedAmount,
      stakedValueUsd: stakedAmount,
      esSO4Balance: fromSorobanAmount(stakingInfo.data?.stakedEsSO4 ?? 0n, 7),
      multiplierPoints: fromSorobanAmount(stakingInfo.data?.stakedMultiplierPoints ?? 0n, 7),
    } satisfies UserSO4Stats,
  }
}

export function usePoolsApy() {
  return { gmPools: GM_POOLS, glvVaults: GLV_VAULTS }
}
