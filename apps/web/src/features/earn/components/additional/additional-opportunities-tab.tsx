import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useUserSO4Stats } from "../../hooks/use-earn-data"
import { compoundRewards, vestEsSO4 } from "../../lib/earn"
import { formatToken } from "@/shared/lib/format"



function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-prose space-y-1.5">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{description}</p>
          {children && <div className="pt-2">{children}</div>}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  isLoading,
}: {
  label: string
  value: string
  isLoading?: boolean
}) {
  return (
    <div className="flex items-center gap-6">
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-0.5 h-4 w-24" />
        ) : (
          <p className="text-[12px] font-medium tabular-nums">{value}</p>
        )}
      </div>
    </div>
  )
}

export function AdditionalOpportunitiesTab() {
  const { data: so4Stats, isLoading } = useUserSO4Stats()
  const [vestPending, setVestPending] = useState(false)
  const [compoundPending, setCompoundPending] = useState(false)

  async function handleVest() {
    setVestPending(true)
    try {
      // TODO: open vesting modal with amount input + confirmation
      await vestEsSO4("DUMMY_ACCOUNT", so4Stats?.esSO4Balance ?? 0)
    } finally {
      setVestPending(false)
    }
  }

  async function handleCompound() {
    setCompoundPending(true)
    try {
      // TODO: pass real wallet account from wallet context
      await compoundRewards("DUMMY_ACCOUNT")
    } finally {
      setCompoundPending(false)
    }
  }

  const hasEsSO4 = (so4Stats?.esSO4Balance ?? 0) > 0
  const hasMultiplierPoints = (so4Stats?.multiplierPoints ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* esSO4 Vesting */}
      <SectionCard
        title="esSO4 Vesting"
        description="Convert esSO4 (escrowed SO4) into SO4 tokens over a 12-month linear vesting period. Tokens unlock gradually — claim anytime."
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            disabled={vestPending || !hasEsSO4}
            onClick={() => void handleVest()}
          >
            {vestPending ? "Starting…" : "Vest now"}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <StatRow
            label="esSO4 balance"
            value={formatToken(so4Stats?.esSO4Balance ?? 0, "esSO4", { minDecimals: 2 })}
            isLoading={isLoading}
          />
          <StatRow label="Vesting duration" value="12 months" />
          <StatRow label="Conversion rate" value="1 esSO4 → 1 SO4" />
        </div>
      </SectionCard>

      {/* Multiplier Points */}
      <SectionCard
        title="Multiplier Points"
        description="Stake SO4 continuously to earn Multiplier Points (MPs). MPs boost your staking power proportionally, increasing your fee-reward share without additional token exposure or sell pressure."
        action={
          <Button
            size="sm"
            className="h-8 text-[12px]"
            disabled={compoundPending || !hasMultiplierPoints}
            onClick={() => void handleCompound()}
          >
            {compoundPending ? "Compounding…" : "Compound"}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <StatRow
            label="Multiplier Points"
            value={formatToken(so4Stats?.multiplierPoints ?? 0, "MP", { minDecimals: 2 })}
            isLoading={isLoading}
          />
          <StatRow label="Boost cap" value="100% of base APR" />
          <StatRow label="Accrual rate" value="100% APR on staked SO4" />
        </div>
      </SectionCard>

      {/* Referrals */}
      <SectionCard
        title="Referrals"
        description="Share your referral code to earn fee discounts and rebates. Referrers receive a percentage of their referees' trading fees, paid in USDC every epoch."
        action={
          <Link to="/referrals">
            <Button size="sm" variant="outline" className="h-8 text-[12px]">
              Go to Referrals →
            </Button>
          </Link>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <StatRow label="Referrer rebate" value="5% of referee fees" />
          <StatRow label="Referee discount" value="5% fee reduction" />
          <StatRow label="Paid in" value="USDC weekly" />
        </div>
      </SectionCard>
    </div>
  )
}
