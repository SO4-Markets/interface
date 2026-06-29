import { useMutation } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { stakeSO4, unstakeSO4 } from "../../lib/earn"

export function useStakeMutation() {
  const { address } = useWalletStore()

  return useMutation({
    mutationFn: async ({
      action,
      amount,
      durationMultiplier,
    }: {
      action: "stake" | "unstake"
      amount: number
      durationMultiplier?: number
    }) => {
      if (!address) throw new Error("Wallet not connected")

      if (action === "stake") {
        return stakeSO4(address, amount) // Note: smart contract currently only accepts account & amount
      } else {
        return unstakeSO4(address, amount)
      }
    },
  })
}
