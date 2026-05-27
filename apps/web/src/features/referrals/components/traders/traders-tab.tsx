import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {  useTraderStats } from "../../hooks/use-referrals-data"
import { setTraderReferralCode, validateReferralCode } from "../../lib/referrals"
import { TimePeriodFilter } from "../shared/time-period-filter"
import { StatChartCard } from "../shared/stat-chart-card"
import type {TimePeriod} from "../../hooks/use-referrals-data";

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
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateReferralCode(code)
    if (err) { setError(err); return }
    setError(null)
    setPending(true)
    try {
      // TODO: pass real wallet account from wallet context
      await setTraderReferralCode("DUMMY_ACCOUNT", code.toUpperCase().trim())
      onSuccess()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Benefits banner */}
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
            close fee. Rewards scale with the affiliate's tier.
          </p>
        </div>
      </div>

      {/* Input */}
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
              disabled={pending || !code.trim()}
              className="h-9 shrink-0 px-5"
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </form>

      {/* Tier breakdown */}
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
  isLoading: boolean
  period: TimePeriod
  onPeriodChange: (p: TimePeriod) => void
}

function Overview({ stats, isLoading, period, onPeriodChange }: OverviewProps) {
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
            value={stats?.discountUsd ?? 0}
            period={period}
            accent="green"
          />
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

type Props = {
  onCodeApplied: () => void
}

export function TradersTab({ onCodeApplied }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("total")
  const { data: stats, isLoading } = useTraderStats(period)

  const hasCode = Boolean(stats?.referralCode)

  return (
    <div className="space-y-5">
      {!hasCode && !isLoading && (
        <JoinCodeForm onSuccess={onCodeApplied} />
      )}
      <Overview
        stats={stats}
        isLoading={isLoading}
        period={period}
        onPeriodChange={setPeriod}
      />
    </div>
  )
}
