import { useQuery } from "@tanstack/react-query"
import type { TierLevel } from "@/lib/contracts/referral-storage"
import type { TimePeriod } from "../hooks/use-referrals-data"

export type ReferralStats = {
  /** Number of traders who registered under the code. */
  totalTraders: number
  /** Volume traded by referees in the last 24h, in USD. */
  volume24hUsd: number
  /** All-time volume traded by referees, in USD. */
  totalVolumeUsd: number
  /** Total rebates/commissions earned by the affiliate, in USD. */
  totalRebatesUsd: number
  /** Affiliate tier derived from referred volume. */
  tier: TierLevel
}

/**
 * Aggregate stats for an affiliate `code` (#57): total traders, 24h and
 * all-time referred volume, total rebates earned, and tier. Drives
 * `affiliates-tab.tsx`. Disabled until a code is known.
 */
export function useReferralStats(code: string | null, period: TimePeriod = "total") {
  return useQuery<ReferralStats>({
    queryKey: ["referrals", "stats", code, period],
    queryFn: async (): Promise<ReferralStats> => {
      // TODO: read ReferralStorage aggregate stats for `code` over `period`
      // (trader count, referred volume, accrued rebates) and derive the tier.
      return {
        totalTraders: 0,
        volume24hUsd: 0,
        totalVolumeUsd: 0,
        totalRebatesUsd: 0,
        tier: 1,
      }
    },
    enabled: !!code,
    staleTime: 60_000,
  })
}
