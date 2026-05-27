import { useState } from "react"
import { Button } from "@workspace/ui/components/button"

import { useAffiliateStats, useDistributions } from "../../hooks/use-referrals-data"
import { claimDistribution } from "../../lib/referrals"
import { formatToken, formatUsd } from "@/shared/lib/format"



export function DistributionsTab() {
  const { data: distributions = [], isLoading } = useDistributions()
  const { data: affiliateStats } = useAffiliateStats()
  const [claiming, setClaiming] = useState<string | null>(null)

  const hasAffiliateCode = Boolean(affiliateStats?.code)

  async function handleClaim(id: string) {
    setClaiming(id)
    try {
      // TODO: pass real wallet account from wallet context
      await claimDistribution("DUMMY_ACCOUNT", id)
    } finally {
      setClaiming(null)
    }
  }

  if (!hasAffiliateCode && !isLoading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-muted-foreground/50">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/70">Register an affiliate code to access distributions</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Switch to the Affiliates tab and create your code to unlock this section.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-[13px] font-semibold">Commission Distributions</h3>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Commissions from your referrals' trading fees are distributed weekly every Thursday.
          Payments are made in USDC directly to your wallet. Unclaimed distributions accumulate
          and can be claimed at any time.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { label: "Distribution cycle", value: "Weekly (Thu)" },
            { label: "Payment token", value: "USDC" },
            { label: "Claim window", value: "No expiry" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-[12px] font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Distributions table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/25 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Epoch</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Token</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">USD value</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {distributions.length > 0 ? (
                distributions.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{d.epoch}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{d.date}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{formatToken(d.amount, d.token)}</td>
                    <td className="px-5 py-3.5 font-mono">{d.token}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{formatUsd(d.amountUsd)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="xs"
                        disabled={claiming === d.id}
                        onClick={() => void handleClaim(d.id)}
                      >
                        {claiming === d.id ? "…" : "Claim"}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <p className="text-sm text-muted-foreground">No distributions yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Commissions will appear here after your first weekly distribution
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
