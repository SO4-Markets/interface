import { CandlestickSeries, LineStyle, createChart } from "lightweight-charts"
import { useEffect, useMemo, useRef, useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"
import { LiveRegion, useAnnouncer } from "@workspace/ui/components/live-region"
import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadRow,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useOracleCandles } from "../../hooks/useOracleCandles"
import { useLiveBar } from "../../hooks/useLiveBar"
import { usePositions } from "../../hooks/usePositions"
import {
  buildCandleOptions,
  buildChartOptions,
  getChartPalette,
  positionLineColor,
} from "../../lib/chart-theme"
import type { CandlestickData, IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts"
import type { OhlcBar } from "../../lib/oracle"
import { formatUsd } from "@/shared/lib/format"

type ChartLine = {
  id: string
  title: string
  price: number
  color: string
  lineStyle?: LineStyle
}

type Props = {
  symbol: string
  period: string
}

type ChartSummary = {
  timeRange: string
  latestPrice: string
  trend: string
  description: string
}

function getChartSummary(
  candles: Array<OhlcBar>,
  liveBar: OhlcBar | null,
  symbol: string,
  period: string,
): ChartSummary | null {
  if (candles.length === 0) return null
  const first = candles[0]
  const last = candles[candles.length - 1]
  const latest = liveBar ?? last
  const start = new Date(first.time * 1000).toLocaleDateString()
  const end = new Date(last.time * 1000).toLocaleDateString()
  const timeRange = first.time === last.time ? start : `${start} – ${end}`
  const latestPrice = formatUsd(latest.close, { decimals: 4 })
  const mid = (candles[0].open + last.close) / 2
  const change = mid === 0 ? 0 : ((last.close - candles[0].open) / mid) * 100
  const trend = change > 0.5 ? "upward" : change < -0.5 ? "downward" : "sideways"
  const description =
    `${period} chart for ${symbol}. ` +
    `Range: ${timeRange}. ` +
    `Latest: ${latestPrice}. ` +
    `Trend: ${trend}.`
  return { timeRange, latestPrice, trend, description }
}

function getRepresentativeRows(
  candles: Array<OhlcBar>,
  maxRows = 15,
): Array<OhlcBar> {
  if (candles.length <= maxRows) return candles
  const step = Math.floor((candles.length - 2) / (maxRows - 2))
  const rows: Array<OhlcBar> = [candles[0]]
  for (let i = 1; i < maxRows - 1; i++) {
    rows.push(candles[i * step])
  }
  rows.push(candles[candles.length - 1])
  return rows
}

function toChartBar(bar: OhlcBar): CandlestickData<UTCTimestamp> {
  return {
    time: bar.time as UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }
}

export function TVChartContainer({ symbol, period }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map())
  // True only after setData() has been called for the current symbol+period.
  // Prevents series.update() from firing against an empty or stale series.
  const hasDataRef = useRef(false)

  const {
    data: candles = [],
    isLoading: isQueryLoading = false,
    isError = false,
    isPlaceholderData = false,
    isFetching = false,
  } = useOracleCandles(symbol, period)

  const liveBar = useLiveBar(symbol, period)
  const { data: positions = [] } = usePositions()

  const [showTable, setShowTable] = useState(false)
  const lastAnnounceRef = useRef(0)
  const announcer = useAnnouncer()

  // Bumped by the theme observer below so colour-dependent effects re-run.
  const [themeVersion, setThemeVersion] = useState(0)

  const hasData = candles.length > 0
  const isLoading = isQueryLoading || (!hasData && isFetching)
  const isStale = isPlaceholderData || (isFetching && hasData)
  const isIdle = !isLoading && !hasData && !isError

  const summary = useMemo(() => getChartSummary(candles, liveBar, symbol, period), [candles, liveBar, symbol, period])
  const tableRows = useMemo(() => getRepresentativeRows(candles), [candles])

  const currentSymbolRef = useRef(symbol)
  const currentPeriodRef = useRef(period)

  // ── Mount chart once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const palette = getChartPalette()

    const chart = createChart(containerRef.current, {
      ...buildChartOptions(palette),
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    })

    const series = chart.addSeries(CandlestickSeries, buildCandleOptions(palette))

    chartRef.current = chart
    seriesRef.current = series

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

    // Watch <html class="dark|light"> and re-theme the chart immediately —
    // no reload needed. Bumping themeVersion re-colours the series and the
    // position lines through the effects below.
    const themeObserver = new MutationObserver(() => {
      const next = getChartPalette()
      chart.applyOptions(buildChartOptions(next))
      series.applyOptions(buildCandleOptions(next))
      setThemeVersion((v) => v + 1)
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
      seriesRef.current = null
      priceLineRefs.current.clear()
    }
  }, []) // mount once — symbol/period changes handled by separate effects below

  // ── Handle symbol / period changes ──────────────────────────────────────────
  useEffect(() => {
    const symbolChanged = currentSymbolRef.current !== symbol
    currentSymbolRef.current = symbol
    currentPeriodRef.current = period

    if (!seriesRef.current) return

    // On market switch, clear price lines immediately since they belong to the previous market
    if (symbolChanged) {
      priceLineRefs.current.forEach((pl) => seriesRef.current!.removePriceLine(pl))
      priceLineRefs.current.clear()

      // When switching markets, if placeholder data is not active (i.e. not same market timeframe switch),
      // clear the series immediately so old-market candles are never presented under a different market.
      if (!isPlaceholderData && candles.length === 0) {
        seriesRef.current.setData([])
        hasDataRef.current.current = false
      }
    }
  }, [symbol, period, isPlaceholderData, candles.length])

  // ── Load historical candles ────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return
    if (candles.length === 0) {
      seriesRef.current.setData([])
      hasDataRef.current.current = false
      return
    }
    seriesRef.current.setData(candles.map(toChartBar))
    hasDataRef.current.current = true
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  // ── Push live bar updates ─────────────────────────────────────────────────
  // Only allowed after historical data is loaded (hasDataRef guards the race
  // where a live bar arrives before the first setData call completes).
  useEffect(() => {
    if (!seriesRef.current || !liveBar || !hasDataRef.current.current) return
    try {
      seriesRef.current.update(toChartBar(liveBar))
    } catch {
      // Live bar occasionally arrives out-of-order during rapid switching — safe to ignore
    }
  }, [liveBar])

  // ── Draw position entry + liquidation price lines ─────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return

    const palette = getChartPalette()

    // Build the desired set of lines from open positions
    const desiredLines: Array<ChartLine> = positions
      .filter((p) => p.indexToken === symbol)
      .flatMap((p) => {
        const lines: Array<ChartLine> = [
          {
            id: `${p.key}-entry`,
            title: `${p.isLong ? "Long" : "Short"} Entry`,
            price: p.entryPrice,
            color: positionLineColor(palette, p.isLong),
            lineStyle: LineStyle.Dashed,
          },
        ]
        if (p.liquidationPrice > 0) {
          lines.push({
            id: `${p.key}-liq`,
            title: `${p.isLong ? "Long" : "Short"} Liq.`,
            price: p.liquidationPrice,
            color: palette.liquidation,
            lineStyle: LineStyle.LargeDashed,
          })
        }
        return lines
      })

    const desiredIds = new Set(desiredLines.map((l) => l.id))

    // Remove stale lines
    priceLineRefs.current.forEach((priceLine, id) => {
      if (!desiredIds.has(id)) {
        seriesRef.current?.removePriceLine(priceLine)
        priceLineRefs.current.delete(id)
      }
    })

    // Add new lines, and re-colour the ones already drawn so a theme switch
    // repaints them in place.
    desiredLines.forEach((line) => {
      const existing = priceLineRefs.current.get(line.id)
      if (existing) {
        existing.applyOptions({ color: line.color })
        return
      }
      const priceLine = seriesRef.current!.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: line.lineStyle ?? LineStyle.Dashed,
        axisLabelVisible: true,
        title: line.title,
      })
      priceLineRefs.current.set(line.id, priceLine)
    })
  }, [positions, symbol, themeVersion])

  // ── Throttled live-price announcements ────────────────────────────────────
  const THROTTLE_MS = 5000
  useEffect(() => {
    if (!liveBar || !summary) return
    const now = Date.now()
    if (now - lastAnnounceRef.current < THROTTLE_MS) return
    lastAnnounceRef.current = now
    announcer.announce(`${symbol} ${summary.latestPrice}`)
  }, [liveBar, summary, symbol, announcer])

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ═══ Chart area ═══════════════════════════════════════════════════════ */}
      <div className="relative min-h-0 flex-1">
        {/* Accessible summary for screen readers */}
        {summary && (
          <VisuallyHidden id="chart-desc">
            {summary.description}
          </VisuallyHidden>
        )}

        {/* Loading skeleton overlay */}
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col gap-1 p-2 bg-background/50 backdrop-blur-[1px]"
            role="status"
            aria-label={`Loading ${period} chart data for ${symbol}…`}
          >
            <Skeleton className="h-full w-full rounded-none opacity-50" />
            <VisuallyHidden>Loading {period} chart data for {symbol}…</VisuallyHidden>
          </div>
        )}

        {/* Stale / updating timeframe indicator */}
        {isStale && !isLoading && (
          <div
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur border border-border"
            role="status"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Updating {period}…</span>
          </div>
        )}

        {/* Empty state */}
        {isIdle && (
          <div role="status" className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No trading data available for {symbol}
          </div>
        )}

        {/* Error state */}
        {isError && !hasData && (
          <div role="alert" className="flex h-full items-center justify-center text-xs text-destructive">
            Unable to load chart data for {symbol}
          </div>
        )}

        {/* Lightweight Charts canvas — hidden from AT; the VisuallyHidden summary replaces it */}
        <div
          ref={containerRef}
          className={cn("h-full w-full transition-opacity duration-150", isStale && "opacity-60")}
          role="img"
          aria-label={`Price chart for ${symbol}`}
          aria-describedby="chart-desc"
          aria-hidden={isIdle || (isError && !hasData)}
        />
      </div>

      {/* ═══ Data-table fallback ══════════════════════════════════════════════ */}
      {hasData && tableRows.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-expanded={showTable}
            aria-controls="ohlc-data-table"
          >
            <span className="font-medium">{symbol} OHLC Data</span>
            <span aria-hidden="true">{showTable ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {showTable && (
            <div className="overflow-x-auto px-3 pb-2" id="ohlc-data-table">
              <Table>
                <TableHeader>
                  <TableHeadRow>
                    <TableHead>
                      <span className="sr-only">Time</span>
                      <span aria-hidden="true">Date</span>
                    </TableHead>
                    <TableHead align="right">Open</TableHead>
                    <TableHead align="right">High</TableHead>
                    <TableHead align="right">Low</TableHead>
                    <TableHead align="right">Close</TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((bar) => (
                    <TableRow key={bar.time} interactive={false}>
                      <TableCell>
                        {new Date(bar.time * 1000).toLocaleString()}
                      </TableCell>
                      <TableCell align="right">{formatUsd(bar.open, { decimals: 4 })}</TableCell>
                      <TableCell align="right">{formatUsd(bar.high, { decimals: 4 })}</TableCell>
                      <TableCell align="right">{formatUsd(bar.low, { decimals: 4 })}</TableCell>
                      <TableCell align="right">{formatUsd(bar.close, { decimals: 4 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ═══ Live price announcer (throttled, polite) ════════════════════════ */}
      <LiveRegion
        message={announcer.message}
        announcementKey={announcer.announcementKey}
        mode="polite"
        atomic
      />
    </div>
  )
}
