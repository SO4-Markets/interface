import { cn } from "@workspace/ui/lib/utils"
import { formatUsd } from "@/shared/lib/format"

type DistributionRow = {
  epoch: string
  date: string
  amountUsd: number
  token: string
  status: "distributed" | "pending" | "upcoming"
}

// TODO: Replace with live data fetched from Stellar event log or subgraph:
//   - Query RewardsDistributor.Distribute events for connected account
//   - Paginate by epoch (weekly snapshots stored in DataStore)
//   - Fields: epochId, timestamp, tokenAmount, tokenAddress, txHash
const MOCK_DISTRIBUTIONS: Array<DistributionRow> = []

const STATUS_STYLES: Record<DistributionRow["status"], string> = {
  distributed: "bg-green-500/10 text-green-400 border-green-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  upcoming: "bg-muted/60 text-muted-foreground border-border",
}

const STATUS_LABEL: Record<DistributionRow["status"], string> = {
  distributed: "Distributed",
  pending: "Pending",
  upcoming: "Upcoming",
}

function StatusBadge({ status }: { status: DistributionRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}



function InfoCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-2 text-[13px] font-semibold">Fee Distribution Schedule</h3>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Protocol fees are collected continuously and distributed weekly to SO4 stakers and
        liquidity providers. Your share is proportional to your staking power (staked amount ×
        duration multiplier). USDC fees are distributed directly; platform fees are used for
        buybacks and distributed as esSO4.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Distribution cycle", value: "Weekly" },
          { label: "Fee allocation", value: "70% to stakers" },
          { label: "Remaining", value: "27% Treasury" },
          { label: "Protocol", value: "3% team" },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-[12px] font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DistributionsTab() {
  return (
    <div className="space-y-4">
      <InfoCard />

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">Distribution History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/25 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Epoch</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Token</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Tx</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DISTRIBUTIONS.length > 0 ? (
                MOCK_DISTRIBUTIONS.map((row) => (
                  <tr
                    key={`${row.epoch}-${row.token}`}
                    className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{row.epoch}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{row.date}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{formatUsd(row.amountUsd)}</td>
                    <td className="px-5 py-3.5 font-mono">{row.token}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-muted-foreground/50">—</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                    <p className="text-sm">No distributions yet</p>
                    <p className="mt-1 text-xs opacity-60">
                      Your distribution history will appear here once the protocol goes live
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
