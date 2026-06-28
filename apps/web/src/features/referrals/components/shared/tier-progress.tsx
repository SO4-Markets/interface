import { cn } from "@workspace/ui/lib/utils"
import { getTierByLevel, getNextTier } from "../../data/tiers"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  tier: 1 | 2 | 3
  volumeUsd: number
}

export function TierProgress({ tier, volumeUsd }: Props) {
  const current = getTierByLevel(tier)
  const next = getNextTier(tier)

  if (!next) {
    return (
      <div
        role="status"
        aria-label="tier progress"
        className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-2.5"
      >
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
            current.colorClass,
            current.ringClass,
          )}
        >
          {current.label}
        </span>
        <span className="text-[12px] font-medium text-yellow-400">Maximum tier reached!</span>
      </div>
    )
  }

  const progress = Math.min((volumeUsd / next.minVolumeUsd) * 100, 100)
  const remaining = Math.max(next.minVolumeUsd - volumeUsd, 0)

  return (
    <div
      role="status"
      aria-label="tier progress"
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
              current.colorClass,
              current.ringClass,
            )}
          >
            {current.label}
          </span>
          <span className="text-[11px] text-muted-foreground">→</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
              next.colorClass,
              next.ringClass,
            )}
          >
            {next.label}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground" aria-label="remaining volume">
          {formatUsd(remaining, { compact: true })} more needed
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`progress to ${next.label}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
