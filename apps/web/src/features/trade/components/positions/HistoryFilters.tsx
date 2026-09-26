import { MARKETS } from "../../data/markets"
import type { HistoryTimeRange } from "../../lib/order-history"

type Props = {
  marketKey: string | null
  range: HistoryTimeRange
  onMarketChange: (marketKey: string | null) => void
  onRangeChange: (range: HistoryTimeRange) => void
  stage?: string
  onStageChange?: (stage: string) => void
}

const stages = [
  ["all", "All statuses"],
  ["pending", "Pending index"],
  ["accepted", "Open"],
  ["partially-filled", "Partially filled"],
  ["frozen", "Frozen"],
  ["pending-cancellation", "Cancelling"],
  ["filled", "Filled"],
  ["cancelled", "Cancelled"],
] as const

export function HistoryFilters({
  marketKey,
  range,
  onMarketChange,
  onRangeChange,
  stage,
  onStageChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Market
        <select
          aria-label="Market filter"
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={marketKey ?? "all"}
          onChange={(event) => onMarketChange(event.target.value === "all" ? null : event.target.value)}
        >
          <option value="all">All markets</option>
          {MARKETS.map((market) => (
            <option key={market.address} value={market.address}>
              {market.name}
            </option>
          ))}
        </select>
      </label>

      {stage !== undefined && onStageChange && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Status
          <select
            aria-label="Order status filter"
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={stage}
            onChange={(event) => onStageChange(event.target.value)}
          >
            {stages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Time
        <select
          aria-label="Time range filter"
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={range}
          onChange={(event) => onRangeChange(event.target.value as HistoryTimeRange)}
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="all">All time</option>
        </select>
      </label>
    </div>
  )
}
