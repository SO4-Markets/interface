import { useQuery } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { ReferralStorageClient } from "@/lib/contracts/referral-storage"

/**
 * Reads the affiliate code registered to the connected wallet from
 * ReferralStorage (#56). Returns `null` when the wallet has no code.
 *
 * Drives `code-display.tsx` via the referrals page/sidebar.
 */
export function useReferralCode() {
  const address = useWalletStore((state) => state.address)

  return useQuery<string | null>({
    queryKey: ["referrals", "code", address],
    queryFn: async (): Promise<string | null> => {
      const client = new ReferralStorageClient()
      const info = await client.getReferralInfo(address as string)
      return info.code
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}
