export type Tier = {
  level: 1 | 2 | 3
  label: string
  /** Monthly referred volume threshold in USD to reach this tier */
  minVolumeUsd: number
  traderDiscountPct: number
  affiliateCommissionPct: number
  colorClass: string
  ringClass: string
}

export const TIERS: Array<Tier> = [
  {
    level: 1,
    label: "Bronze",
    minVolumeUsd: 0,
    traderDiscountPct: 5,
    affiliateCommissionPct: 5,
    colorClass: "text-orange-400 bg-orange-500/10",
    ringClass: "ring-orange-500/30",
  },
  {
    level: 2,
    label: "Silver",
    minVolumeUsd: 2_500,
    traderDiscountPct: 5,
    affiliateCommissionPct: 10,
    colorClass: "text-slate-300 bg-slate-500/10",
    ringClass: "ring-slate-400/30",
  },
  {
    level: 3,
    label: "Gold",
    minVolumeUsd: 25_000,
    traderDiscountPct: 5,
    affiliateCommissionPct: 15,
    colorClass: "text-yellow-400 bg-yellow-500/10",
    ringClass: "ring-yellow-400/30",
  },
]

export function getTierByLevel(level: 1 | 2 | 3): Tier {
  return TIERS[level - 1]
}

export function getTierFromVolume(volumeUsd: number): Tier {
  return [...TIERS].reverse().find((t) => volumeUsd >= t.minVolumeUsd) ?? TIERS[0]
}

export function getNextTier(current: 1 | 2 | 3): Tier | null {
  return TIERS[current] ?? null
}
