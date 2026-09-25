import { queryClient } from "@/app/providers/QueryProvider"
import { NETWORK } from "@/app/config/network"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import {
  affiliateCodeStorageKey,
  buildClaimRebatesTransaction,
  buildRegisterCodeTransaction,
  buildSetTraderReferralCodeTransaction,
  mapContractError,
  parseSorobanError,
  referralPromptStorageKey,
} from "@/lib/contracts"
import { submitTx } from "@/shared/hooks/useTxSubmit"
import { queryKeys } from "@/shared/lib/query-keys"
import { walletKit } from "@/features/wallet/lib/wallet-kit"

function isValidAccount(account: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(account)
}

async function invalidateReferralQueries(account: string, code?: string | null): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.code(account) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.tier(account) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.traderStatsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.distributionsAll() }),
    ...(code
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.stats(code) })]
      : []),
  ])
}

export async function setTraderReferralCode(account: string, code: string): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before applying a referral code.")
  }

  const normalized = code.toUpperCase().trim()

  return submitTx(
    async () => {
      const tx = await buildSetTraderReferralCodeTransaction(account, normalized)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Joining with code "${normalized}"...`,
      successMessage: `Referral code "${normalized}" applied`,
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: async () => {
        if (typeof window !== "undefined") {
          localStorage.setItem(referralPromptStorageKey(account), "1")
        }
        await invalidateReferralQueries(account)
      },
      onError: (error) => mapContractError(error) || parseSorobanError(error),
    },
  )
}

/** Alias used by the trade-panel first-trade referral prompt (#133). */
export const applyReferralCode = setTraderReferralCode

export async function createAffiliateCode(account: string, code: string): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before creating a referral code.")
  }

  const normalized = code.toUpperCase().trim()
  const validationError = validateReferralCode(code)
  if (validationError) {
    throw new Error(validationError)
  }

  return submitTx(
    async () => {
      const tx = await buildRegisterCodeTransaction(account, normalized)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Registering code "${normalized}"...`,
      successMessage: `Code "${normalized}" registered!`,
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: async () => {
        if (typeof window !== "undefined") {
          localStorage.setItem(affiliateCodeStorageKey(account), normalized)
        }
        await invalidateReferralQueries(account, normalized)
      },
      onError: (error) => mapContractError(error) || parseSorobanError(error),
    },
  )
}

export async function claimRebates(account: string, epochIds: Array<string>): Promise<string> {
  if (!isValidAccount(account)) {
    throw new Error("Connect your wallet before claiming rebates.")
  }
  if (epochIds.length === 0) {
    throw new Error("No rebate epochs selected.")
  }

  return submitTx(
    async () => {
      const tx = await buildClaimRebatesTransaction(account, epochIds)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage:
        epochIds.length === 1
          ? "Claiming rebate..."
          : `Claiming ${epochIds.length} rebates...`,
      successMessage: "Rebates claimed",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: async () => {
        await invalidateReferralQueries(account)
        await queryClient.invalidateQueries({ queryKey: queryKeys.referrals.statsAll() })
      },
      onError: (error) => mapContractError(error) || parseSorobanError(error),
    },
  )
}

export async function claimDistribution(account: string, epochId: string): Promise<string> {
  return claimRebates(account, [epochId])
}

export function validateReferralCode(code: string): string | null {
  const upper = code.toUpperCase().trim()
  if (!upper) return "Code is required"
  if (upper.length < 3) return "Minimum 3 characters"
  if (upper.length > 20) return "Maximum 20 characters"
  if (!/^[A-Z0-9_]+$/.test(upper)) return "Only letters, numbers, and underscores allowed"
  return null
}

export function hasCompletedReferralPrompt(account: string): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(referralPromptStorageKey(account)) === "1"
}

export function markReferralPromptComplete(account: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(referralPromptStorageKey(account), "1")
}

export function readStoredAffiliateCode(account: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(affiliateCodeStorageKey(account))
}
