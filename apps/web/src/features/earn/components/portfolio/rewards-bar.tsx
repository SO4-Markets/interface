import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useEarnStats } from "../../hooks/use-earn-data"
import { claimRewards } from "../../lib/earn"
import { formatPct, formatUsd } from "@/shared/lib/format"



function StatItem({
  label,
  value,
  isLoading,
  mono = true,
}: {
  label: string
  value: string
  isLoading?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span className={`text-sm font-medium ${mono ? "tabular-nums" : ""}`}>{value}</span>
      )}
    </div>
  )
}

function InfoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="mt-[1px] shrink-0"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

export function RewardsBar() {
  const [bannerOpen, setBannerOpen] = useState(true)
  const { data: stats, isLoading } = useEarnStats()
  const [claiming, setClaiming] = useState(false)

  async function handleClaim() {
    setClaiming(true)
    try {
      // TODO: pass real wallet account address from wallet context
      await claimRewards("DUMMY_ACCOUNT")
    } finally {
      setClaiming(false)
    }
  }

  const hasPendingRewards = (stats?.totalPendingRewardsUsd ?? 0) > 0

  return (
    <div className="space-y-3">
      {bannerOpen && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-blue-400">
          <InfoIcon />
          <p className="flex-1 text-[12px] leading-relaxed">
            Protocol fees are accumulating in the Treasury for SO4 buybacks. Rewards will be
            distributed to stakers proportional to staking power{" "}
            <span className="font-medium">(duration × amount staked)</span> when the buyback
            threshold is reached.
          </p>
          <button
            aria-label="Dismiss"
            onClick={() => setBannerOpen(false)}
            className="mt-0.5 shrink-0 text-blue-400/50 transition-colors hover:text-blue-400"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-border bg-card px-6 py-4">
        <StatItem
          label="Total investment value"
          value={formatUsd(stats?.totalInvestmentUsd ?? 0)}
          isLoading={isLoading}
        />

        <div className="h-8 w-px shrink-0 bg-border" />

        <StatItem
          label="Total earned"
          value={formatUsd(stats?.totalEarnedUsd ?? 0)}
          isLoading={isLoading}
        />

        <div className="h-8 w-px shrink-0 bg-border" />

        <StatItem
          label="Total pending rewards"
          value={formatUsd(stats?.totalPendingRewardsUsd ?? 0)}
          isLoading={isLoading}
        />

        <div className="h-8 w-px shrink-0 bg-border" />

        <StatItem
          label="Staking Power Share"
          value={formatPct(stats?.stakingPowerSharePct ?? 0, { sign: false })}
          isLoading={isLoading}
        />

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={claiming || !hasPendingRewards}
            onClick={() => void handleClaim()}
            className="h-9 gap-2 text-[12px]"
          >
            <GiftIcon />
            {claiming ? "Claiming…" : "Claim rewards"}
          </Button>
        </div>
      </div>
    </div>
  )
}
