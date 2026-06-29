import { useMutation } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { createAffiliateCode } from "../lib/referrals"

export function useCreateReferralCodeMutation() {
  const { address } = useWalletStore()

  return useMutation({
    mutationFn: async (code: string) => {
      if (!address) throw new Error("Wallet not connected")
      return createAffiliateCode(address, code)
    },
  })
}
