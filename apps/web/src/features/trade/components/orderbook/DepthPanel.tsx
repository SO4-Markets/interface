import { useEffect, useMemo } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {  buildDepth } from "../../lib/orderbook/depth"
import {
  
  formatBucketPrice,
  formatScaled,
  isValidMetadata,
  rowSizeDisplay,
  tickFor
} from "../../lib/orderbook/display-prefs"
import {  depthFraction, selectVisibleDepth } from "../../lib/orderbook/layout"
import { selectDisplayPrefs, useOrderBookDisplayStore } from "../../store/orderbook-display-store"
import { DepthControls } from "./DepthControls"
import { SourceHealthBadge } from "./SourceHealthBadge"
import type {VisibleDepth} from "../../lib/orderbook/layout";
import type {MarketDisplayMetadata} from "../../lib/orderbook/display-prefs";
import type {DepthRow} from "../../lib/orderbook/depth";
import type { BookLevel } from "../../lib/orderbook/book-reducer"
import type { SourceHealth } from "../../hooks/useSourceHealth"

type Props = {
  metadata: MarketDisplayMetadata | null
  /** Canonical levels, in any order. Never modified here. */
  bids: ReadonlyArray<BookLevel>
  asks: ReadonlyArray<BookLevel>
  /** Rows available for depth, excluding the spread row. */
  rows: number
  /** Freshness of the feed the levels came from; shown in every layout. */
  health?: SourceHealth | null
  className?: string
}

function Row({
  row,
  side,
  visible,
  metadata,
  unit,
}: {
  row: DepthRow
  side: "bid" | "ask"
  visible: VisibleDepth
  metadata: MarketDisplayMetadata
  unit: "base" | "quote"
}) {
  const display = rowSizeDisplay(row, unit, metadata)
  const fill = `${(depthFraction(row, visible) * 100).toFixed(1)}%`
  return (
    <div role="row" className="relative flex h-5 items-center font-mono text-xs select-none">
      {/* Depth bar. Deliberately not animated: rows re-sort as the book moves and a
          transition here would make the ladder shimmer rather than clarify anything. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0",
          side === "bid" ? "right-0 bg-long-subtle" : "left-0 bg-short-subtle",
        )}
        style={{ width: fill }}
      />
      <span role="cell" className={cn("relative z-10 w-2/5 shrink-0 px-2 tabular-nums", side === "bid" ? "text-long" : "text-short")}>
        {formatBucketPrice(row.price, metadata)}
      </span>
      <span role="cell" className="relative z-10 w-[30%] shrink-0 px-1 text-right tabular-nums text-foreground">
        {display.size}
      </span>
      <span role="cell" className="relative z-10 flex-1 px-2 text-right tabular-nums text-muted-foreground">
        {display.cumulative}
      </span>
    </div>
  )
}

/**
 * OB-052 / OB-053: the depth ladder with grouping, unit and layout controls.
 *
 * The live feed is NOT owned here: levels arrive as props from a parent that
 * holds the subscription, so switching layout, grouping or unit only recomputes
 * a display view and can never remount or restart the feed.
 *
 * Display only. Bucket prices are labels, not executable prices, and nothing
 * here feeds a price into an order ticket.
 */
export function DepthPanel({ metadata, bids, asks, rows, health = null, className }: Props) {
  const layout = useOrderBookDisplayStore((s) => s.layout)
  const setLayout = useOrderBookDisplayStore((s) => s.setLayout)
  const setGrouping = useOrderBookDisplayStore((s) => s.setGrouping)
  const setUnit = useOrderBookDisplayStore((s) => s.setUnit)
  const reconcileMarket = useOrderBookDisplayStore((s) => s.reconcileMarket)
  const byMarket = useOrderBookDisplayStore((s) => s.byMarket)

  const usable = isValidMetadata(metadata) ? metadata : null

  // Replace stored choices the market no longer supports (precision changed, etc.).
  // Runs for unusable metadata too: a market that lost its precision can no longer
  // honour a stored grouping, and that has to be reset rather than kept.
  useEffect(() => {
    if (metadata?.marketId) reconcileMarket(metadata)
  }, [metadata, reconcileMarket])

  const prefs = usable ? selectDisplayPrefs({ byMarket }, usable) : { groupingMultiplier: 1, unit: "base" as const }
  const { groupingMultiplier } = prefs

  // Depends on the grouping only: the unit changes how a row is printed, not what it contains.
  const depth = useMemo(
    () => (usable ? buildDepth(bids, asks, { tick: tickFor({ groupingMultiplier, unit: "base" }, usable) }) : null),
    [usable, bids, asks, groupingMultiplier],
  )
  const visible = useMemo(() => (depth ? selectVisibleDepth(depth, layout, rows) : null), [depth, layout, rows])

  return (
    <section aria-label="Order book depth" className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        {/* Market identity is part of every layout. */}
        <h3 className="font-mono text-xs font-semibold text-foreground">
          {usable ? `${usable.baseSymbol}/${usable.quoteSymbol}` : "Market unavailable"}
        </h3>
        {health ? <SourceHealthBadge health={health} /> : null}
      </header>

      <div className="border-b border-border px-2 py-1">
        <DepthControls
          metadata={usable}
          groupingMultiplier={prefs.groupingMultiplier}
          unit={prefs.unit}
          layout={layout}
          onGroupingChange={(multiplier) => usable && setGrouping(usable, multiplier)}
          onUnitChange={(unit) => usable && setUnit(usable.marketId, unit)}
          onLayoutChange={setLayout}
        />
      </div>

      {usable && depth && visible ? (
        <div role="table" aria-label={`${usable.baseSymbol}/${usable.quoteSymbol} depth, size in ${prefs.unit === "base" ? usable.baseSymbol : usable.quoteSymbol}`} className="min-h-0 flex-1 overflow-hidden">
          <div role="row" className="flex h-5 items-center border-b border-border font-mono text-xs text-muted-foreground">
            <span role="columnheader" className="w-2/5 shrink-0 px-2">Price</span>
            <span role="columnheader" className="w-[30%] shrink-0 px-1 text-right">Size ({prefs.unit === "base" ? usable.baseSymbol : usable.quoteSymbol})</span>
            <span role="columnheader" className="flex-1 px-2 text-right">Total</span>
          </div>

          {visible.asks.map((row) => (
            <Row key={`a${row.price}`} row={row} side="ask" visible={visible} metadata={usable} unit={prefs.unit} />
          ))}

          {/* The spread comes from the canonical book, so grouping cannot move it. */}
          <div role="separator" aria-label="Spread" className="flex h-5 items-center justify-between border-y border-border bg-muted px-2 font-mono text-xs text-muted-foreground">
            <span>
              Spread{" "}
              <span className="text-foreground">
                {depth.crossed ? "crossed" : depth.spread !== null ? formatScaled(depth.spread, usable.priceScale, 2) : "—"}
              </span>
            </span>
          </div>

          {visible.bids.map((row) => (
            <Row key={`b${row.price}`} row={row} side="bid" visible={visible} metadata={usable} unit={prefs.unit} />
          ))}

          {visible.asks.length === 0 && visible.bids.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No depth to show.</p>
          ) : null}
        </div>
      ) : (
        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
          Market precision is unavailable, so depth cannot be grouped or sized.
        </p>
      )}
    </section>
  )
}
