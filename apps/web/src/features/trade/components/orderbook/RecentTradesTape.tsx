import { memo, useRef } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadRow,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useRecentTrades } from "../../hooks/useRecentTrades"
import { SourceHealthBadge } from "./SourceHealthBadge"
import type { TradeItem } from "../../hooks/useRecentTrades"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
}

// OB-119: Memoized trade row to prevent unnecessary re-renders when new trades arrive.
// Each row only re-renders if its own data changes.
const TradeRow = memo(function TradeRow({ trade }: { trade: TradeItem }) {
  return (
    <TableRow key={trade.id} interactive={false} className="font-mono text-[11px]">{/* ds-allow: dense trade row font size */}
      <TableCell className="font-medium text-foreground">
        {formatUsd(trade.price, { decimals: 4 })}
      </TableCell>
      <TableCell align="right" className="text-muted-foreground">
        {trade.qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
      </TableCell>
      <TableCell align="right" className="text-muted-foreground/80">
        {new Date(trade.time).toLocaleTimeString()}
      </TableCell>
      <TableCell align="right">
        {trade.side === "buy" ? (
          <span className="font-semibold text-green-500">Buy</span>
        ) : trade.side === "sell" ? (
          <span className="font-semibold text-red-500">Sell</span>
        ) : (
          <span className="text-muted-foreground" title="Side unknown">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // OB-119: Only re-render if this specific trade changed
  const prev = prevProps.trade
  const next = nextProps.trade
  return (
    prev.id === next.id &&
    prev.price === next.price &&
    prev.qty === next.qty &&
    prev.time === next.time &&
    prev.side === next.side
  )
})

export function RecentTradesTape({ symbol }: Props) {
  const { trades, status, isLoading, sourceHealth } = useRecentTrades(symbol)
  const containerRef = useRef<HTMLDivElement>(null)

  const showStaleOverlay = sourceHealth.status === "stale" || 
                           sourceHealth.status === "reconnecting" ||
                           sourceHealth.status === "revision-gap"

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-xs relative">
      {/* ── Sub-header with venue and feed status indicator ───────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">{/* ds-allow: dense orderbook font size */}
          {symbol ?? "Market"} Trades
        </span>
        <SourceHealthBadge health={sourceHealth} />
      </div>

      {/* ── Scrollable trades list ───────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-1 relative">
        {/* OB-058: Stale data overlay */}
        {showStaleOverlay && trades.length > 0 && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-lg text-center max-w-[200px]">
              <p className="text-xs font-medium text-foreground mb-1">
                {sourceHealth.status === "stale" && "Data Stale"}
                {sourceHealth.status === "reconnecting" && "Reconnecting"}
                {sourceHealth.status === "revision-gap" && "Resyncing"}
              </p>
              <p className="text-[10px] text-muted-foreground"> {/* ds-allow: overlay secondary text */}
                {sourceHealth.message}
              </p>
            </div>
          </div>
        )}
        
        {isLoading && trades.length === 0 ? (
          <div className="flex flex-col gap-1.5 p-2" role="status" aria-label="Loading recent trades…">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : trades.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground" role="status">
            No recent trades available for {symbol ?? "selected market"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>Price</TableHead>
                <TableHead align="right">Size</TableHead>
                <TableHead align="right">Time</TableHead>
                <TableHead align="right">Side</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
