import { useQuery } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { VestingRouterClient, type VestingSchedule } from "@/lib/contracts/vesting-router"

/**
 * Reads the connected wallet's esSO4 vesting state from VestingRouter (#55):
 * `deposited`, `vested`, `claimable`, and `vestingEndTimestamp`. Drives the
 * vesting section of the Earn portfolio tab.
 */
export function useVestingSchedule() {
  const address = useWalletStore((state) => state.address)

  return useQuery<VestingSchedule>({
    queryKey: ["earn", "vesting-schedule", address],
    queryFn: async (): Promise<VestingSchedule> => {
      const client = new VestingRouterClient()
      return client.getVestingSchedule(address as string)
    },
    enabled: !!address,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}
