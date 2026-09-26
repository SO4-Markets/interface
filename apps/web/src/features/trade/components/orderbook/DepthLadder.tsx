import { cn } from "@workspace/ui/lib/utils"
import {  useOrderBook } from "../../hooks/useOrderBook"
import type {OrderBookLevel} from "../../hooks/useOrderBook";
import { formatUsd } from "@/shared/lib/format"
import { useRecentTrades } from "../../hooks/useRecentTrades"
import { useState } from "react"

type Props = {
  symbol: string | undefined
  compact?: boolean
}

// ── single row ───────────────────────────────────────────────────────────────

type RowProps = {
  level: OrderBookLevel
  side: "bid" | "ask"
  compact: boolean
  onHover?: (level: OrderBookLevel | null) => void
}

function DepthRow({ level, side, compact, onHover }: RowProps) {
  const isBid = side === "bid"
  const depthPct = `${(level.depth * 100).toFixed(1)}%`

  return (
    <div
      role="row"
      className={cn(
        "relative flex items-center font-mono text-[11px] select-none cursor-pointer transition-colors", // ds-allow: dense orderbook row font size
        compact ? "h-[18px]" : "h-[22px]",
        "hover:bg-muted/30 focus-within:bg-muted/30",
      )}
      onMouseEnter={() => onHover?.(level)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(level)}
      onBlur={() => onHover?.(null)}
      tabIndex={0}
      aria-label={`${isBid ? "Bid" : "Ask"} at ${formatUsd(level.price, { decimals: 2 })}, size ${level.size.toFixed(4)}, cumulative ${level.total.toFixed(4)}`}
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

// ── cumulative depth inspection tooltip ───────────────────────────────────────

function DepthInspection({
  level,
  side,
}: {
  level: OrderBookLevel
  side: "bid" | "ask"
}) {
  const avgPrice = level.total > 0 ? (level.price * level.size + (level.total - level.size) * level.price) / level.total : level.price
  const notional = level.total * avgPrice

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-50 rounded-md border border-border bg-popover px-3 py-2 shadow-lg"
      style={{
        [side === "bid" ? "left" : "right"]: "100%",
        top: "0",
        marginLeft: side === "bid" ? "0.5rem" : undefined,
        marginRight: side === "ask" ? "0.5rem" : undefined,
      }}
    >
      <div className="space-y-0.5 text-[11px] font-mono whitespace-nowrap"> {/* ds-allow: tooltip detail font size */}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cumulative Qty:</span>
          <span className="text-foreground font-medium">
            {level.total.toLocaleString(undefined, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 6,
            })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Avg Price:</span>
          <span className="text-foreground font-medium">
            {formatUsd(avgPrice, { decimals: 4 })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Notional:</span>
          <span className="text-foreground font-medium">
            {formatUsd(notional, { decimals: 2 })}
          </span>
        </div>
        <div className="mt-1 pt-1 border-t border-border text-[10px] text-muted-foreground italic"> {/* ds-allow: tooltip disclaimer font size */}
          Snapshot estimate
        </div>
      </div>
    </div>
  )
}

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
  referencePrice,
  referencePriceLabel,
}: {
  spread: number | null
  spreadPct: number | null
  midPrice: number | null
  referencePrice: number | null
  referencePriceLabel: string
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
        {spreadPct !== null && <span className="ml-1">({spreadPct.toFixed(3)}%)</span>}
      </span>
      {referencePrice !== null && (
        <span title={referencePriceLabel}>
          {referencePriceLabel === "Last" && (
            <span className="mr-0.5 opacity-60">Last</span>
          )}
          {referencePriceLabel === "Mid" && (
            <span className="mr-0.5 opacity-60">Mid</span>
          )}
          {referencePriceLabel === "Mark" && (
            <span className="mr-0.5 opacity-60">Mark</span>
          )}
          <span className="text-foreground/70">
            {formatUsd(referencePrice, { decimals: 2 })}
          </span>
        </span>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function DepthLadder({ symbol, compact = false }: Props) {
  const { bids, asks, spread, spreadPct, midPrice, status, isLoading } =
    useOrderBook(symbol)
  const { trades } = useRecentTrades(symbol)

  // OB-054: Determine reference price — prefer last trade, fall back to mid price
  const lastTradePrice = trades[0]?.price ?? null
  const referencePrice = lastTradePrice ?? midPrice
  const referencePriceLabel = lastTradePrice !== null ? "Last" : midPrice !== null ? "Mid" : "Mark"

  // OB-056: Cumulative depth inspection state
  const [hoveredLevel, setHoveredLevel] = useState<{ level: OrderBookLevel; side: "bid" | "ask" } | null>(null)

  const isEmpty = bids.length === 0 && asks.length === 0

  return (
    <div
      role="table"
      aria-label={`${symbol ?? "Market"} order-book depth ladder`}
      className="flex h-full w-full flex-col overflow-hidden text-xs"
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">{/* ds-allow: dense header font size */}
          {symbol ?? "Market"} Depth
        </span>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-green-500">{/* ds-allow: status font size */}
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">{/* ds-allow: status font size */}
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
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive">{/* ds-allow: status font size */}
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
            className="flex min-h-0 flex-1 flex-col overflow-hidden relative"
          >
            <ColumnHeaders compact={compact} />
            <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
              {asks.map((level) => (
                <div key={level.price} className="relative">
                  <DepthRow
                    level={level}
                    side="ask"
                    compact={compact}
                    onHover={(lvl) => setHoveredLevel(lvl ? { level: lvl, side: "ask" } : null)}
                  />
                  {hoveredLevel?.level === level && hoveredLevel.side === "ask" && (
                    <DepthInspection level={level} side="ask" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Spread */}
          <SpreadRow 
            spread={spread} 
            spreadPct={spreadPct} 
            midPrice={midPrice}
            referencePrice={referencePrice}
            referencePriceLabel={referencePriceLabel}
          />

          {/* Bids (buys) — descending price */}
          <div
            role="rowgroup"
            aria-label="Bid orders"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto relative"
          >
            {bids.map((level) => (
              <div key={level.price} className="relative">
                <DepthRow
                  level={level}
                  side="bid"
                  compact={compact}
                  onHover={(lvl) => setHoveredLevel(lvl ? { level: lvl, side: "bid" } : null)}
                />
                {hoveredLevel?.level === level && hoveredLevel.side === "bid" && (
                  <DepthInspection level={level} side="bid" />
                )}
              </div>
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
