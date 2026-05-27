import { useQuery } from "@tanstack/react-query"
import { GLV_VAULTS, GM_POOLS } from "../data/pools"

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
  return useQuery<EarnStats>({
    queryKey: ["earn", "stats"],
    queryFn: async (): Promise<EarnStats> => {
      // TODO: Fetch from Stellar Soroban contracts:
      //   - StakingReader.getUserInfo(account) → stakedAmount, esSO4, MPs
      //   - RewardsDistributor.getPendingRewards(account) → esSO4Pending, nativePending
      //   - Convert all balances to USD via PriceOracle
      //   - stakingPowerSharePct = userBoostedStake / totalBoostedStake * 100
      return {
        totalInvestmentUsd: 0,
        totalEarnedUsd: 0,
        totalPendingRewardsUsd: 0,
        stakingPowerSharePct: 0,
      }
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function useUserGmPositions() {
  return useQuery<Array<UserGmPosition>>({
    queryKey: ["earn", "gm-positions"],
    queryFn: async (): Promise<Array<UserGmPosition>> => {
      // TODO: For each pool in GM_POOLS:
      //   const balance = await SyntheticsReader.getMarketTokenBalance(pool.address, account)
      //   const price = await SyntheticsReader.getMarketTokenPrice(pool.address)
      //   return only pools where balance > 0
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
      // TODO: For each vault in GLV_VAULTS:
      //   const balance = await GlvReader.getGlvTokenBalance(vault.address, account)
      //   const price = await GlvReader.getGlvTokenPrice(vault.address)
      //   return only vaults where balance > 0
      return []
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function useUserSO4Stats() {
  return useQuery<UserSO4Stats>({
    queryKey: ["earn", "so4-stats"],
    queryFn: async (): Promise<UserSO4Stats> => {
      // TODO: Call StakingReader.getUserInfo(account) on Soroban:
      //   walletBalance: SO4 balance from Stellar Horizon account endpoint
      //   stakedAmount: tokens locked in RewardTracker contract
      //   esSO4Balance: non-transferable escrowed token balance
      //   multiplierPoints: boost points from continuous staking duration
      return {
        walletBalance: 0,
        stakedAmount: 0,
        stakedValueUsd: 0,
        esSO4Balance: 0,
        multiplierPoints: 0,
      }
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function usePoolsApy() {
  // TODO: Replace static APY with usePerformanceAnnualized({ period: "30d" }) equivalent:
  //   reads historical fee snapshots from DataStore and annualizes over the chosen window
  return { gmPools: GM_POOLS, glvVaults: GLV_VAULTS }
}
