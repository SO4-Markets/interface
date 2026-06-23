import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDistributions, useTraderStats } from "../../hooks/use-referrals-data"
import { useReferralStats } from "../../queries/useReferralStats"
import {
  claimRebates,
  setTraderReferralCode,
  validateReferralCode,
} from "../../lib/referrals"
import { TimePeriodFilter } from "../shared/time-period-filter"
import { StatChartCard } from "../shared/stat-chart-card"
import type { TimePeriod } from "../../hooks/use-referrals-data"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { formatUsd } from "@/shared/lib/format"


function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso))
}

type JoinCodeFormProps = {
  onSuccess: () => void
}

function JoinCodeForm({ onSuccess }: JoinCodeFormProps) {
  const account = useWalletStore((state) => state.address)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!account) {
      setError("Connect your wallet first")
      return
    }
    const err = validateReferralCode(code)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setPending(true)
    try {
      await setTraderReferralCode(account, code.toUpperCase().trim())
      onSuccess()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to apply code")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex gap-4 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8" r="6" />
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-semibold">Enter a referral code to receive a fee discount</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Get up to <span className="font-semibold text-green-400">5% off</span> every open and
            close fee. Rewards scale with the affiliate&apos;s tier.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="referral-code" className="text-[12px] font-medium text-muted-foreground">
            Referral code
          </label>
          <div className="flex gap-2">
            <input
              id="referral-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError(null)
              }}
              placeholder="e.g. MYCODE123"
              autoComplete="off"
              spellCheck={false}
              className="flex h-9 w-full rounded-lg border border-border bg-muted/30 px-3 font-mono text-[13px] tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <Button
              type="submit"
              size="sm"
              disabled={pending || !code.trim() || !account}
              className="h-9 shrink-0 px-5"
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </form>

      <div className="mt-6 border-t border-border pt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Discount tiers
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Bronze", pct: 5, vol: "Any volume", color: "text-orange-400 bg-orange-500/10 ring-orange-500/20" },
            { label: "Silver", pct: 5, vol: "$2.5K+ / mo", color: "text-slate-300 bg-slate-500/10 ring-slate-400/20" },
            { label: "Gold", pct: 5, vol: "$25K+ / mo", color: "text-yellow-400 bg-yellow-500/10 ring-yellow-400/20" },
          ].map((tier) => (
            <div key={tier.label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tier.color}`}>
                {tier.label}
              </span>
              <p className="mt-2 text-[15px] font-bold text-green-400">{tier.pct}%</p>
              <p className="text-[10px] text-muted-foreground">{tier.vol}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type OverviewProps = {
  stats: ReturnType<typeof useTraderStats>["data"]
  rebateStats: ReturnType<typeof useReferralStats>["data"]
  isLoading: boolean
  period: TimePeriod
  onPeriodChange: (p: TimePeriod) => void
  onClaimRebates: () => void
  claiming: boolean
}

function Overview({
  stats,
  rebateStats,
  isLoading,
  period,
  onPeriodChange,
  onClaimRebates,
  claiming,
}: OverviewProps) {
  const claimable = rebateStats?.claimableRebateUsd ?? stats?.claimableRebateUsd ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Overview</h2>
        <TimePeriodFilter value={period} onChange={onPeriodChange} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatChartCard
            title="Trading volume"
            tooltip="Your total trading volume during this period"
            value={stats?.tradingVolumeUsd ?? 0}
            period={period}
            accent="blue"
          />
          <StatChartCard
            title="Discounts"
            tooltip="Total fee savings from your referral code"
            value={stats?.discountUsd ?? rebateStats?.totalRebatesUsd ?? 0}
            period={period}
            accent="green"
          />
        </div>
      )}

      {claimable > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Claimable rebates</p>
            <p className="text-lg font-semibold tabular-nums">{formatUsd(claimable)}</p>
          </div>
          <Button size="sm" disabled={claiming} onClick={onClaimRebates}>
            {claiming ? "Claiming…" : "Claim rebates"}
          </Button>
        </div>
      )}

      {stats?.lastUpdated && (
        <p className="text-[11px] text-muted-foreground">
          Last updated:{" "}
          <span className="font-mono text-foreground/60">{fmtDate(stats.lastUpdated)}</span>
        </p>
      )}
    </div>
  )
}

function DistributionsHistory() {
  const { data: distributions = [], isLoading } = useDistributions()

  if (isLoading) {
    return <Skeleton className="h-32 rounded-xl" />
  }

  if (distributions.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border px-5 py-3.5">
        <h3 className="text-[13px] font-semibold">Rebate history</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/25 text-left">
              <th className="px-5 py-3 font-medium text-muted-foreground">Epoch</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {distributions.map((d) => (
              <tr key={d.id} className="border-b border-border/40 last:border-b-0">
                <td className="px-5 py-3 font-mono text-muted-foreground">{d.epoch}</td>
                <td className="px-5 py-3 text-muted-foreground">{d.date}</td>
                <td className="px-5 py-3 text-right font-mono">{formatUsd(d.amountUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type Props = {
  onCodeApplied: () => void
}

export function TradersTab({ onCodeApplied }: Props) {
  const account = useWalletStore((state) => state.address)
  const [period, setPeriod] = useState<TimePeriod>("total")
  const [claiming, setClaiming] = useState(false)

  const { data: stats, isLoading, refetch } = useTraderStats(period)
  const { data: rebateStats, isLoading: rebateLoading } = useReferralStats(
    stats?.referralCode ?? null,
    period,
  )

  const hasCode = Boolean(stats?.referralCode)

  async function handleClaimRebates() {
    if (!account) return
    const epochs =
      rebateStats && rebateStats.claimableRebateUsd > 0
        ? ["latest"]
        : stats?.claimableRebateUsd
          ? ["latest"]
          : []
    if (epochs.length === 0) return

    setClaiming(true)
    try {
      await claimRebates(account, epochs)
      await refetch()
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="space-y-5">
      {!hasCode && !isLoading && <JoinCodeForm onSuccess={onCodeApplied} />}
      <Overview
        stats={stats}
        rebateStats={rebateStats}
        isLoading={isLoading || rebateLoading}
        period={period}
        onPeriodChange={setPeriod}
        onClaimRebates={() => void handleClaimRebates()}
        claiming={claiming}
      />
      <DistributionsHistory />
    </div>
  )
}
