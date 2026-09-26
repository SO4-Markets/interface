import { useEffect, useMemo, useRef, useState } from "react"
import { AreaSeries, createChart } from "lightweight-charts"
import type { IChartApi, ISeriesApi, LineSeriesData, UTCTimestamp } from "lightweight-charts"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"
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
import { cn } from "@workspace/ui/lib/utils"
import { getChartPalette, buildChartOptions } from "../../lib/chart-theme"
import type { OrderBookLevel } from "../../hooks/useOrderBook"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  bids: Array<OrderBookLevel>
  asks: Array<OrderBookLevel>
  isLoading: boolean
  status: "connecting" | "connected" | "disconnected" | "error"
}

function buildDepthChartData(levels: Array<OrderBookLevel>): Array<LineSeriesData> {
  return levels.map((level) => ({
    time: Math.round(level.price) as UTCTimestamp,
    value: level.total,
  }))
}

export function DepthChart({ symbol, bids, asks, isLoading, status }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const bidsSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const asksSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const [showTable, setShowTable] = useState(false)

  const isEmpty = bids.length === 0 && asks.length === 0
  const hasData = bids.length > 0 || asks.length > 0

  // Memoize chart data to avoid unnecessary series updates
  const bidsChartData = useMemo(() => buildDepthChartData(bids), [bids])
  const asksChartData = useMemo(() => buildDepthChartData(asks), [asks])

  // ── Mount chart once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const palette = getChartPalette()

    const chart = createChart(containerRef.current, {
      ...buildChartOptions(palette),
      handleScroll: { mouseWheel: false, pressedMouseMove: false },
      handleScale: { mouseWheel: false, pinch: false },
      autoSize: true,
    })

    // Bids: left side (green)
    const bidsSeries = chart.addSeries(AreaSeries, {
      topColor: palette.long + "40",  // 25% opacity
      bottomColor: palette.long + "00", // transparent
      lineColor: palette.long,
      lineWidth: 2,
      title: "Bid Depth",
    })

    // Asks: right side (red)
    const asksSeries = chart.addSeries(AreaSeries, {
      topColor: palette.down + "40",
      bottomColor: palette.down + "00",
      lineColor: palette.down,
      lineWidth: 2,
      title: "Ask Depth",
    })

    chartRef.current = chart
    bidsSeriesRef.current = bidsSeries
    asksSeriesRef.current = asksSeries

    // Responsive resize
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    resizeObserver.observe(containerRef.current)

    // Watch theme changes
    const themeObserver = new MutationObserver(() => {
      const next = getChartPalette()
      chart.applyOptions(buildChartOptions(next))
      bidsSeries.applyOptions({
        topColor: next.long + "40",
        bottomColor: next.long + "00",
        lineColor: next.long,
      })
      asksSeries.applyOptions({
        topColor: next.down + "40",
        bottomColor: next.down + "00",
        lineColor: next.down,
      })
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      bidsSeriesRef.current = null
      asksSeriesRef.current = null
    }
  }, [])

  // ── Update bid side data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!bidsSeriesRef.current || bidsChartData.length === 0) return
    bidsSeriesRef.current.setData(bidsChartData)
    chartRef.current?.timeScale().fitContent()
  }, [bidsChartData])

  // ── Update ask side data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!asksSeriesRef.current || asksChartData.length === 0) return
    asksSeriesRef.current.setData(asksChartData)
    // Only fit content on bids update; both sides must load together
    if (bidsChartData.length === 0) {
      chartRef.current?.timeScale().fitContent()
    }
  }, [asksChartData, bidsChartData])

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ═══ Header with status ════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="font-mono text-[11px] text-muted-foreground">
          {symbol ?? "Market"} Cumulative Depth
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
          {(status === "disconnected" || status === "error") && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* ═══ Chart area ════════════════════════════════════════════════════════ */}
      <div className="relative min-h-0 flex-1">
        {/* Accessible summary for screen readers */}
        <VisuallyHidden id="depth-chart-desc">
          Cumulative depth chart for {symbol ?? "market"}. {hasData ? `Displaying ${bids.length} bid levels and ${asks.length} ask levels.` : "No depth data available."}
        </VisuallyHidden>

        {/* Loading skeleton */}
        {isLoading && isEmpty && (
          <div
            className="absolute inset-0 z-10 flex flex-col gap-1 p-2 bg-background/50 backdrop-blur-[1px]"
            role="status"
            aria-label={`Loading depth chart for ${symbol}…`}
          >
            <Skeleton className="h-full w-full rounded-none opacity-50" />
            <VisuallyHidden>Loading depth chart for {symbol}…</VisuallyHidden>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <div role="status" className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No depth data available for {symbol ?? "selected market"}
          </div>
        )}

        {/* Chart canvas */}
        <div
          ref={containerRef}
          className={cn("h-full w-full transition-opacity duration-150", isLoading && "opacity-60")}
          role="img"
          aria-label={`Cumulative depth chart for ${symbol}`}
          aria-describedby="depth-chart-desc"
          aria-hidden={isEmpty}
        />
      </div>

      {/* ═══ Data-table fallback ══════════════════════════════════════════════ */}
      {hasData && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-expanded={showTable}
            aria-controls="depth-data-table"
          >
            <span className="font-medium">{symbol} Cumulative Depth</span>
            <span aria-hidden="true">{showTable ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {showTable && (
            <div className="overflow-x-auto px-3 pb-2" id="depth-data-table">
              <Table>
                <TableHeader>
                  <TableHeadRow>
                    <TableHead>Type</TableHead>
                    <TableHead align="right">Price</TableHead>
                    <TableHead align="right">Size</TableHead>
                    <TableHead align="right">Total</TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {/* Bids */}
                  {bids.map((level) => (
                    <TableRow key={`bid-${level.price}`} interactive={false}>
                      <TableCell className="text-long">Bid</TableCell>
                      <TableCell align="right">{formatUsd(level.price, { decimals: 4 })}</TableCell>
                      <TableCell align="right">{formatUsd(level.size, { decimals: 2 })}</TableCell>
                      <TableCell align="right">{formatUsd(level.total, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  {/* Asks */}
                  {asks.map((level) => (
                    <TableRow key={`ask-${level.price}`} interactive={false}>
                      <TableCell className="text-short">Ask</TableCell>
                      <TableCell align="right">{formatUsd(level.price, { decimals: 4 })}</TableCell>
                      <TableCell align="right">{formatUsd(level.size, { decimals: 2 })}</TableCell>
                      <TableCell align="right">{formatUsd(level.total, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
