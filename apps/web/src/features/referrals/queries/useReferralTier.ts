import { useQuery } from "@tanstack/react-query"
import type { TierLevel } from "@/lib/contracts"
import { referralStorageClient } from "@/lib/contracts"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { queryKeys } from "@/shared/lib/query-keys"

/**
 * Reads a wallet's trader tier from ReferralStorage (#58). Falls back to the
 * connected wallet when no `address` is provided. Replaces the hard-coded mock
 * tier used by the referral UI (see `data/tiers.ts` for tier definitions).
 */
export function useReferralTier(address?: string) {
  const connected = useWalletStore((state) => state.address)
  const target = address ?? connected

  return useQuery<TierLevel>({
    queryKey: queryKeys.referrals.tier(target ?? null),
    queryFn: async (): Promise<TierLevel> => {
      const client = referralStorageClient
      return client.getTraderTier(target as string)
    },
    enabled: !!target,
    staleTime: 60_000,
  })
}
