import {
  
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  
  
  
  LineStyle,
  
  createChart
} from "lightweight-charts"
import { useEffect, useRef } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useOracleCandles } from "../../hooks/useOracleCandles"
import { useLiveBar } from "../../hooks/useLiveBar"
import { usePositions } from "../../hooks/usePositions"
import type {CandlestickData, IChartApi, IPriceLine, ISeriesApi, UTCTimestamp} from "lightweight-charts";
import type { OhlcBar } from "../../lib/oracle"

const CHART_COLORS = {
  dark: {
    background: "#0d0e1a",
    text: "#9598a1",
    grid: "#1e2035",
    crosshair: "#444860",
    crosshairLabel: "#2a2e3e",
    border: "#1e2035",
  },
  light: {
    background: "#ffffff",
    text: "#4b5563",
    grid: "#e5e7eb",
    crosshair: "#9ca3af",
    crosshairLabel: "#f3f4f6",
    border: "#e5e7eb",
  },
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark")
}

function buildChartOptions(isDark: boolean) {
  const c = isDark ? CHART_COLORS.dark : CHART_COLORS.light
  return {
    layout: {
      background: { type: ColorType.Solid, color: c.background },
      textColor: c.text,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: c.grid, style: LineStyle.Solid },
      horzLines: { color: c.grid, style: LineStyle.Solid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: c.crosshair, labelBackgroundColor: c.crosshairLabel },
      horzLine: { color: c.crosshair, labelBackgroundColor: c.crosshairLabel },
    },
    rightPriceScale: {
      borderColor: c.border,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderColor: c.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
    },
  }
}

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

  const { data: candles = [], isLoading } = useOracleCandles(symbol, period)
  const liveBar = useLiveBar(symbol, period)
  const { data: positions = [] } = usePositions()

  // ── Mount chart once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      ...buildChartOptions(isDarkMode()),
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    })

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

    // Watch <html class="dark|light"> and re-theme the chart immediately
    const themeObserver = new MutationObserver(() => {
      chart.applyOptions(buildChartOptions(isDarkMode()))
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

  // ── Clear stale data immediately when symbol or period changes ───────────────
  // This runs BEFORE the candles effect so there is never a window where
  // series.update() fires against data belonging to a different symbol/period.
  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData([])
    hasDataRef.current = false
    // Remove all price lines — they belong to the previous symbol
    priceLineRefs.current.forEach((pl) => seriesRef.current!.removePriceLine(pl))
    priceLineRefs.current.clear()
  }, [symbol, period])

  // ── Load historical candles ────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return
    seriesRef.current.setData(candles.map(toChartBar))
    hasDataRef.current = true
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  // ── Push live bar updates ─────────────────────────────────────────────────
  // Only allowed after historical data is loaded (hasDataRef guards the race
  // where a live bar arrives before the first setData call completes).
  useEffect(() => {
    if (!seriesRef.current || !liveBar || !hasDataRef.current) return
    try {
      seriesRef.current.update(toChartBar(liveBar))
    } catch {
      // Live bar occasionally arrives out-of-order during rapid switching — safe to ignore
    }
  }, [liveBar])

  // ── Draw position entry + liquidation price lines ─────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return

    // Build the desired set of lines from open positions
    const desiredLines: Array<ChartLine> = positions
      .filter((p) => p.indexToken === symbol)
      .flatMap((p) => {
        const lines: Array<ChartLine> = [
          {
            id: `${p.key}-entry`,
            title: `${p.isLong ? "Long" : "Short"} Entry`,
            price: p.entryPrice,
            color: p.isLong ? "#26a69a" : "#ef5350",
            lineStyle: LineStyle.Dashed,
          },
        ]
        if (p.liquidationPrice > 0) {
          lines.push({
            id: `${p.key}-liq`,
            title: `${p.isLong ? "Long" : "Short"} Liq.`,
            price: p.liquidationPrice,
            color: "#f59e0b",
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

    // Add new lines (skip duplicates)
    desiredLines.forEach((line) => {
      if (!priceLineRefs.current.has(line.id)) {
        const priceLine = seriesRef.current!.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: line.lineStyle ?? LineStyle.Dashed,
          axisLabelVisible: true,
          title: line.title,
        })
        priceLineRefs.current.set(line.id, priceLine)
      }
    })
  }, [positions, symbol])

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col gap-1 p-2">
          <Skeleton className="h-full w-full rounded-none opacity-50" />
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
