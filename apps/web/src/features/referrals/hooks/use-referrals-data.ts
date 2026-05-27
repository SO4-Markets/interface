import { useQuery } from "@tanstack/react-query"

export type TimePeriod = "24h" | "7d" | "30d" | "90d" | "total"

export type TraderStats = {
  referralCode: string | null
  tradingVolumeUsd: number
  discountUsd: number
  discountPct: number
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
  return useQuery<TraderStats>({
    queryKey: ["referrals", "trader-stats", period],
    queryFn: async (): Promise<TraderStats> => {
      // TODO: Fetch from ReferralsReader Soroban contract:
      //   - getUserReferralCode(account) → referralCode bytes32 → decode to string
      //   - getReferralStats(account, period) → tradingVolumeUsd, discountUsd
      //   - Look up the code's tier to get discountPct
      return {
        referralCode: null,
        tradingVolumeUsd: 0,
        discountUsd: 0,
        discountPct: 5,
        lastUpdated: null,
      }
    },
    staleTime: 60_000,
  })
}

export function useAffiliateStats(period: TimePeriod = "total") {
  return useQuery<AffiliateStats>({
    queryKey: ["referrals", "affiliate-stats", period],
    queryFn: async (): Promise<AffiliateStats> => {
      // TODO: Fetch from ReferralsReader Soroban contract:
      //   - getAffiliateCode(account) → code string
      //   - getAffiliateStats(account, period) → referralCount, tradingVolumeUsd, commissionUsd
      //   - getTierLevel(totalVolumeUsd) → tier 1|2|3
      return {
        code: null,
        referralCount: 0,
        tradingVolumeUsd: 0,
        commissionUsd: 0,
        tier: 1,
        lastUpdated: null,
      }
    },
    staleTime: 60_000,
  })
}

export function useAffiliateReferrals() {
  return useQuery<Array<AffiliateReferral>>({
    queryKey: ["referrals", "affiliate-referrals"],
    queryFn: async (): Promise<Array<AffiliateReferral>> => {
      // TODO: Query Stellar subgraph / event log:
      //   - Filter ReferralCodeUpdated events where affiliate === account
      //   - Join with per-address trading stats for volume + commission
      return []
    },
    staleTime: 60_000,
  })
}

export function useDistributions() {
  return useQuery<Array<DistributionEntry>>({
    queryKey: ["referrals", "distributions"],
    queryFn: async (): Promise<Array<DistributionEntry>> => {
      // TODO: Query RewardDistributor events on Stellar:
      //   - Filter DistributionClaimed where affiliate === account
      //   - Group by epoch (weekly), include txHash for explorer link
      return []
    },
    staleTime: 60_000,
  })
}
