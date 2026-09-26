import { memo } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {  useOrderBook } from "../../hooks/useOrderBook"
import { SourceHealthBadge } from "./SourceHealthBadge"
import type {OrderBookLevel} from "../../hooks/useOrderBook";
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  compact?: boolean
}

// ── single row ───────────────────────────────────────────────────────────────

type RowProps = {
  level: OrderBookLevel
  side: "bid" | "ask"
  compact: boolean
}

// OB-119: Memoized row component to prevent unnecessary re-renders when other
// levels update. Price is stable key since it uniquely identifies the level.
const DepthRow = memo(function DepthRow({ level, side, compact }: RowProps) {
  const isBid = side === "bid"
  const depthPct = `${(level.depth * 100).toFixed(1)}%`

  return (
    <div
      role="row"
      className={cn(
        "relative flex items-center font-mono text-[11px] select-none", // ds-allow: dense orderbook row font size
        compact ? "h-[18px]" : "h-[22px]",
      )}
    >
      {/* depth fill — absolutely positioned behind text */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 transition-[width] duration-100",
          isBid
            ? "right-0 bg-green-500/10"
            : "left-0 bg-red-500/10",
        )}
        style={{ width: depthPct }}
      />

      {/* price */}
      <span
        role="cell"
        className={cn(
          "relative z-10 w-[42%] shrink-0 px-2 tabular-nums",
          isBid ? "text-green-500" : "text-red-500",
        )}
      >
        {formatUsd(level.price, { decimals: 2 })}
      </span>

      {/* size */}
      <span
        role="cell"
        className="relative z-10 w-[30%] shrink-0 px-1 text-right tabular-nums text-foreground/80"
      >
        {level.size.toLocaleString(undefined, {
          minimumFractionDigits: 3,
          maximumFractionDigits: 4,
        })}
      </span>

      {/* cumulative total */}
      <span
        role="cell"
        className="relative z-10 flex-1 px-2 text-right tabular-nums text-muted-foreground"
      >
        {level.total.toLocaleString(undefined, {
          minimumFractionDigits: 3,
          maximumFractionDigits: 4,
        })}
      </span>
    </div>
  )
}, (prevProps, nextProps) => {
  // OB-119: Custom equality check — only re-render if this specific level changed
  return (
    prevProps.level.price === nextProps.level.price &&
    prevProps.level.size === nextProps.level.size &&
    prevProps.level.depth === nextProps.level.depth &&
    prevProps.compact === nextProps.compact
  )
})

// ── column headers ────────────────────────────────────────────────────────────

function ColumnHeaders({ compact }: { compact: boolean }) {
  return (
    <div
      role="row"
      className={cn(
        "flex items-center border-b border-border/60 font-mono text-[10px] text-muted-foreground", // ds-allow: dense orderbook header font size
        compact ? "h-[16px]" : "h-[20px]",
      )}
    >
      <span role="columnheader" className="w-[42%] shrink-0 px-2">Price</span>
      <span role="columnheader" className="w-[30%] shrink-0 px-1 text-right">Size</span>
      <span role="columnheader" className="flex-1 px-2 text-right">Total</span>
    </div>
  )
}

// ── spread row ────────────────────────────────────────────────────────────────

function SpreadRow({
  spread,
  spreadPct,
  midPrice,
}: {
  spread: number | null
  spreadPct: number | null
  midPrice: number | null
}) {
  return (
    <div
      role="separator"
      aria-label="Spread"
      className="flex items-center justify-between border-y border-border/60 bg-muted/20 px-2 py-[3px] font-mono text-[10px] text-muted-foreground" // ds-allow: dense orderbook spread font size
    >
      <span>
        Spread{" "}
        {spread !== null ? (
          <span className="text-foreground/70">
            {formatUsd(spread, { decimals: 4 })}
          </span>
        ) : (
          "—"
        )}
      </span>
      {midPrice !== null && (
        <span>
          Mid{" "}
          <span className="text-foreground/70">
            {formatUsd(midPrice, { decimals: 2 })}
          </span>
        </span>
      )}
      {spreadPct !== null && (
        <span>{spreadPct.toFixed(3)}%</span>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function DepthLadder({ symbol, compact = false }: Props) {
  const { bids, asks, spread, spreadPct, midPrice, status, isLoading, sourceHealth } =
    useOrderBook(symbol)

  const isEmpty = bids.length === 0 && asks.length === 0
  const showStaleOverlay = sourceHealth.status === "stale" || 
                           sourceHealth.status === "reconnecting" ||
                           sourceHealth.status === "revision-gap"

  return (
    <div
      role="table"
      aria-label={`${symbol ?? "Market"} order-book depth ladder`}
      className="flex h-full w-full flex-col overflow-hidden text-xs relative"
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">{/* ds-allow: dense header font size */}
          {symbol ?? "Market"} Depth
        </span>
        <SourceHealthBadge health={sourceHealth} />
      </div>

      {/* ── Loading skeleton ───────────────────────────────────────────── */}
      {isLoading && isEmpty && (
        <div
          role="status"
          aria-label="Loading order book…"
          className="flex flex-1 flex-col gap-0.5 p-2"
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="h-[22px] rounded animate-pulse bg-muted/40"
            />
          ))}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!isLoading && isEmpty && (
        <div
          role="status"
          className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground"
        >
          No depth data available for {symbol ?? "selected market"}.
        </div>
      )}

      {/* ── Ladder ─────────────────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden relative">
          {/* OB-058: Stale data overlay */}
          {showStaleOverlay && (
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
          
          {/* Asks (sells) — ascending price, reversed for display top→bottom */}
          <div
            role="rowgroup"
            aria-label="Ask orders"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ColumnHeaders compact={compact} />
            <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
              {asks.map((level) => (
                <DepthRow
                  key={level.price}
                  level={level}
                  side="ask"
                  compact={compact}
                />
              ))}
            </div>
          </div>

          {/* Spread */}
          <SpreadRow spread={spread} spreadPct={spreadPct} midPrice={midPrice} />

          {/* Bids (buys) — descending price */}
          <div
            role="rowgroup"
            aria-label="Bid orders"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            {bids.map((level) => (
              <DepthRow
                key={level.price}
                level={level}
                side="bid"
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* One-sided: only asks ─────────────────────────────────────────── */}
      {!isEmpty && bids.length === 0 && (
        <p className="px-3 pb-1 text-[10px] text-muted-foreground">{/* ds-allow: dense footer font size */}
          No bids available.
        </p>
      )}
      {/* One-sided: only bids ─────────────────────────────────────────── */}
      {!isEmpty && asks.length === 0 && (
        <p className="px-3 pt-1 text-[10px] text-muted-foreground">{/* ds-allow: dense footer font size */}
          No asks available.
        </p>
      )}
    </div>
  )
}
