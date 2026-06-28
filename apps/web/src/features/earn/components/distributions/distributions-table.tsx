import { cn } from "@workspace/ui/lib/utils"
import { formatUsd } from "@/shared/lib/format"

// ── Types ────────────────────────────────────────────────────────────────────

export type DistributionStatus =
  | "distributed"
  | "pending"
  | "upcoming"
  | "claim"
  | "claimed"

export type DistributionRow = {
  epoch: string
  date: string
  amountUsd: number
  token: string
  status: DistributionStatus
  txHash?: string
}

// ── Styling maps ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DistributionStatus, string> = {
  distributed: "bg-green-500/10 text-green-400 border-green-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  upcoming: "bg-muted/60 text-muted-foreground border-border",
  claim: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  claimed: "bg-green-500/10 text-green-400 border-green-500/20",
}

const STATUS_LABEL: Record<DistributionStatus, string> = {
  distributed: "Distributed",
  pending: "Pending",
  upcoming: "Upcoming",
  claim: "Claim",
  claimed: "Claimed",
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DistributionStatus }) {
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

// ── Main component ───────────────────────────────────────────────────────────

type DistributionsTableProps = {
  /** Rows to render. An empty array triggers the empty-state message. */
  distributions: DistributionRow[]
  /** Fires when the user clicks a "Claim" badge. Receives the epoch id. */
  onClaim?: (epochId: string) => void
}

/**
 * Presentational table listing reward distributions.
 *
 * Columns: Epoch · Date · Amount (USD) · Token · Status · Tx
 *
 * The `status` field drives what renders in the Status column:
 *  - `"claim"` → interactive Claim button (fires `onClaim`)
 *  - everything else → static badge
 */
export function DistributionsTable({ distributions, onClaim }: DistributionsTableProps) {
  return (
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
          {distributions.length > 0 ? (
            distributions.map((row) => (
              <tr
                key={`${row.epoch}-${row.token}`}
                className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-5 py-3.5 font-mono text-muted-foreground">{row.epoch}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{row.date}</td>
                <td className="px-5 py-3.5 text-right font-mono">{formatUsd(row.amountUsd)}</td>
                <td className="px-5 py-3.5 font-mono">{row.token}</td>
                <td className="px-5 py-3.5">
                  {row.status === "claim" ? (
                    <button
                      type="button"
                      onClick={() => onClaim?.(row.epoch)}
                      className={cn(
                        "inline-flex h-5 cursor-pointer items-center rounded-full border px-2 text-[10px] font-medium",
                        STATUS_STYLES.claim,
                      )}
                    >
                      Claim
                    </button>
                  ) : (
                    <StatusBadge status={row.status} />
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {row.txHash ? (
                    <span className="font-mono text-muted-foreground">
                      {row.txHash.slice(0, 8)}…
                    </span>
                  ) : (
                    <span className="font-mono text-muted-foreground/50">—</span>
                  )}
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
  )
}
