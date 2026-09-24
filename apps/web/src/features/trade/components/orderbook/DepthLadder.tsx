import { cn } from "@workspace/ui/lib/utils"
import { formatUsd } from "@/shared/lib/format"
import { useOrderBook, type OrderBookLevel } from "../../hooks/useOrderBook"

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

function DepthRow({ level, side, compact }: RowProps) {
  const isBid = side === "bid"
  const depthPct = `${(level.depth * 100).toFixed(1)}%`

  return (
    <div
      role="row"
      className={cn(
        "relative flex items-center font-mono text-[11px] select-none",
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
}

// ── column headers ────────────────────────────────────────────────────────────

function ColumnHeaders({ compact }: { compact: boolean }) {
  return (
    <div
      role="row"
      className={cn(
        "flex items-center border-b border-border/60 font-mono text-[10px] text-muted-foreground",
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
      className="flex items-center justify-between border-y border-border/60 bg-muted/20 px-2 py-[3px] font-mono text-[10px] text-muted-foreground"
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
  const { bids, asks, spread, spreadPct, midPrice, status, isLoading } =
    useOrderBook(symbol)

  const isEmpty = bids.length === 0 && asks.length === 0

  return (
    <div
      role="table"
      aria-label={`${symbol ?? "Market"} order-book depth ladder`}
      className="flex h-full w-full flex-col overflow-hidden text-xs"
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">
          {symbol ?? "Market"} Depth
        </span>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-green-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Connecting…
            </span>
          )}
          {status === "polling" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Polling (Fallback)
            </span>
          )}
          {(status === "disconnected" || status === "error") && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Disconnected
            </span>
          )}
        </div>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        <p className="px-3 pb-1 text-[10px] text-muted-foreground">
          No bids available.
        </p>
      )}
      {/* One-sided: only bids ─────────────────────────────────────────── */}
      {!isEmpty && asks.length === 0 && (
        <p className="px-3 pt-1 text-[10px] text-muted-foreground">
          No asks available.
        </p>
      )}
    </div>
  )
}
