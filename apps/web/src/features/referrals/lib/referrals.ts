import { submitTx } from "@/shared/hooks/useTxSubmit"

function fakeTxDelay(ms = 1500): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

async function runMockWrite(loadingMessage: string, successMessage: string, description: string, delay = 1500): Promise<string> {
  return submitTx(async () => "", {
    loadingMessage,
    successMessage,
    successDescription: () => description,
    execute: async () => {
      await fakeTxDelay(delay)
      return "DUMMY_TX_HASH"
    },
    onError: (error) => (error instanceof Error ? error.message : "Transaction failed"),
  })
}

export async function setTraderReferralCode(_account: string, code: string): Promise<string> {
  return runMockWrite(`Joining with code "${code}"...`, `Referral code "${code}" applied`, "5% fee discount is now active on your trades")
}

export async function createAffiliateCode(_account: string, code: string): Promise<string> {
  return runMockWrite(`Registering code "${code}"...`, `Code "${code}" registered!`, "Share your code to start earning commissions")
}

export async function claimDistribution(_account: string, _epochId: string): Promise<string> {
  return runMockWrite("Claiming distribution...", "Distribution claimed", "Tx: DUMMY_TX_HASH", 1000)
}

export function validateReferralCode(code: string): string | null {
  const upper = code.toUpperCase().trim()
  if (!upper) return "Code is required"
  if (upper.length < 3) return "Minimum 3 characters"
  if (upper.length > 16) return "Maximum 16 characters"
  if (!/^[A-Z0-9_]+$/.test(upper)) return "Only letters, numbers, and underscores allowed"
  return null
}
