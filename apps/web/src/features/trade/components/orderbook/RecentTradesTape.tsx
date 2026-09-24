import { useRef } from "react"
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
import { formatUsd } from "@/shared/lib/format"
import { useRecentTrades } from "../../hooks/useRecentTrades"

type Props = {
  symbol: string | undefined
}

export function RecentTradesTape({ symbol }: Props) {
  const { trades, status, isLoading } = useRecentTrades(symbol)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-xs">
      {/* ── Sub-header with venue and feed status indicator ───────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">
          {symbol ?? "Market"} Trades
        </span>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-green-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Connecting…
            </span>
          )}
          {status === "polling" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Polling (Fallback)
            </span>
          )}
          {(status === "disconnected" || status === "error") && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Disconnected
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable trades list ───────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-1">
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
                <TableRow key={trade.id} interactive={false} className="font-mono text-[11px]">
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
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
