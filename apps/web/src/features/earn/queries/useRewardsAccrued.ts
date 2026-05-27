import { useStakingInfo } from "./useStakingInfo"

export type RewardsAccrued = {
  pendingEsSO4: bigint
  pendingWethFees: bigint
}

export function useRewardsAccrued() {
  const query = useStakingInfo()

  return {
    ...query,
    data: query.data
      ? {
          pendingEsSO4: query.data.pendingEsSO4Rewards,
          pendingWethFees: query.data.pendingWethFees,
        } satisfies RewardsAccrued
      : undefined,
  }
}
