import { useQuery } from "@tanstack/react-query"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { getAffiliateCode, getTraderDiscountBps, getTraderReferralCode, referralStorageClient } from "@/lib/contracts"
import { queryKeys } from "@/shared/lib/query-keys"

export type TimePeriod = "24h" | "7d" | "30d" | "90d" | "total"

export type TraderStats = {
  referralCode: string | null
  tradingVolumeUsd: number
  discountUsd: number
  discountPct: number
  claimableRebateUsd: number
  lastUpdated: string | null
}

export type AffiliateStats = {
  code: string | null
  referralCount: number
  tradingVolumeUsd: number
  commissionUsd: number
  tier: 1 | 2 | 3
  lastUpdated: string | null
}

export type AffiliateReferral = {
  account: string
  volumeUsd: number
  commissionUsd: number
  registeredAt: string
}

export type DistributionEntry = {
  id: string
  epoch: string
  date: string
  token: string
  amount: number
  amountUsd: number
  txHash: string
}

export function useTraderStats(period: TimePeriod = "total") {
  const address = useWalletStore((state) => state.address)

  return useQuery<TraderStats>({
    queryKey: queryKeys.referrals.traderStats(address, period),
    queryFn: async (): Promise<TraderStats> => {
      if (!address) {
        return {
          referralCode: null,
          tradingVolumeUsd: 0,
          discountUsd: 0,
          discountPct: 0,
          claimableRebateUsd: 0,
          lastUpdated: null,
        }
      }

      const client = referralStorageClient
      const [referralCode, rebates, discountBps] = await Promise.all([
        getTraderReferralCode(address),
        client.getTraderRebates(address),
        getTraderDiscountBps(address),
      ])

      const discountPct = referralCode ? Math.max(1, Math.round(discountBps / 100)) : 5

      return {
        referralCode,
        tradingVolumeUsd: rebates.totalDiscountUsd,
        discountUsd: rebates.totalDiscountUsd,
        discountPct,
        claimableRebateUsd: rebates.claimableRebateUsd,
        lastUpdated: new Date().toISOString(),
      }
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}

export function useAffiliateStats(_period: TimePeriod = "total") {
  const address = useWalletStore((state) => state.address)

  return useQuery<AffiliateStats>({
    queryKey: queryKeys.referrals.affiliateStats(address),
    queryFn: async (): Promise<AffiliateStats> => {
      if (!address) {
        return { code: null, referralCount: 0, tradingVolumeUsd: 0, commissionUsd: 0, tier: 1, lastUpdated: null }
      }

      // Read what the contract knows: affiliate's registered code and tier.
      // Volume/commission/referralCount require an off-chain indexer — return 0 honestly.
      const [code, discountBps] = await Promise.all([
        getAffiliateCode(address),
        getTraderDiscountBps(address),
      ])

      const tier: 1 | 2 | 3 = discountBps >= 500 ? 3 : discountBps >= 300 ? 2 : 1

      return {
        code,
        referralCount: 0,
        tradingVolumeUsd: 0,
        commissionUsd: 0,
        tier,
        lastUpdated: code ? new Date().toISOString() : null,
      }
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}

export function useAffiliateReferrals() {
  const address = useWalletStore((state) => state.address)

  return useQuery<Array<AffiliateReferral>>({
    queryKey: queryKeys.referrals.affiliateReferrals(address),
    // Per-referral volume and commission data require an off-chain event indexer.
    // There is no on-chain bulk query for this. Return empty until an indexer exists.
    queryFn: (): Array<AffiliateReferral> => [],
    enabled: !!address,
    staleTime: 60_000,
  })
}

export function useDistributions() {
  const address = useWalletStore((state) => state.address)

  return useQuery<Array<DistributionEntry>>({
    queryKey: queryKeys.referrals.distributions(address),
    // Distribution history requires querying Stellar event logs for DistributionClaimed
    // events — no on-chain bulk read exists. Return empty until an indexer is wired.
    queryFn: (): Array<DistributionEntry> => [],
    enabled: !!address,
    staleTime: 60_000,
  })
}
