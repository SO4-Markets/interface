import { useQuery } from "@tanstack/react-query"
import type { VestingSchedule } from "@/lib/contracts"
import { getVestingRouterClient } from "@/lib/contracts"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { queryKeys } from "@/shared/lib/query-keys"

/**
 * Reads the connected wallet's esSO4 vesting state from VestingRouter (#55):
 * `deposited`, `vested`, `claimable`, and `vestingEndTimestamp`. Drives the
 * vesting section of the Earn portfolio tab.
 */
export function useVestingSchedule() {
  const address = useWalletStore((state) => state.address)

  return useQuery<VestingSchedule>({
    queryKey: queryKeys.earn.vestingSchedule(address ?? ""),
    queryFn: async (): Promise<VestingSchedule> => {
      const client = getVestingRouterClient()
      return client.getVestingSchedule(address as string)
    },
    enabled: !!address,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}
