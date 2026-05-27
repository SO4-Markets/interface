import { useQuery } from "@tanstack/react-query"
import { StakingRouterClient } from "@/lib/contracts/staking-router"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export type StakingInfo = {
  stakedSO4: bigint
  stakedEsSO4: bigint
  stakedMultiplierPoints: bigint
  pendingEsSO4Rewards: bigint
  pendingWethFees: bigint
}

const stakingRouter = new StakingRouterClient()

export function useStakingInfo() {
  const { address, status } = useWalletStore()

  return useQuery<StakingInfo>({
    queryKey: ["earn", "stakingInfo", address],
    queryFn: async (): Promise<StakingInfo> => {
      const info = await stakingRouter.getStakerInfo(address!)

      return {
        stakedSO4: info.stakedSO4 ?? info.stakedAmount,
        stakedEsSO4: info.stakedEsSO4 ?? info.esSO4Balance,
        stakedMultiplierPoints: info.stakedMultiplierPoints,
        pendingEsSO4Rewards: info.pendingEsSO4Rewards ?? info.accruedRewards,
        pendingWethFees: info.pendingWethFees,
      }
    },
    enabled: !!address && status === "connected",
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
