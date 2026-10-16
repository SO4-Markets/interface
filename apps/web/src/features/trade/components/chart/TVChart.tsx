import { useRef } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
import { ChartHeader } from "./ChartHeader"
import { TVChartContainer } from "./TVChartContainer"
import type { Period } from "../../store/chart-preferences-store"

const PERIODS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const

type Props = {
  symbol: string | undefined
  onSelectToken: (address: string) => void
}

export function TVChart({ symbol, onSelectToken }: Props) {
  const period = useChartPreferencesStore((s) => s.period)
  const setPeriod = useChartPreferencesStore((s) => s.setPeriod)
  const buttonRefs = useRef<Map<Period, HTMLButtonElement>>(new Map())

  // When the period changes, persist preference and invalidate the candles cache
  function handlePeriodChange(p: Period) {
    setPeriod(p)
  }

  // Keyboard navigation: Left/Right arrows move between period buttons
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()

    const currentIndex = PERIODS.indexOf(period)
    let nextIndex = currentIndex

    if (e.key === "ArrowLeft") {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : PERIODS.length - 1
    } else {
      nextIndex = currentIndex < PERIODS.length - 1 ? currentIndex + 1 : 0
    }

    const nextPeriod = PERIODS[nextIndex]
    handlePeriodChange(nextPeriod)

    // Focus the next button after render
    setTimeout(() => {
      buttonRefs.current.get(nextPeriod)?.focus()
    }, 0)
  }

  const toolbarRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const activeEl = buttonRefs.current.get(period)
    const toolbar = toolbarRef.current
    if (activeEl && toolbar) {
      const activeRect = activeEl.getBoundingClientRect()
      const toolbarRect = toolbar.getBoundingClientRect()
      setIndicatorStyle({
        left: activeRect.left - toolbarRect.left,
        width: activeRect.width,
      })
    }
  }, [period])

  return (
    <div className="flex h-full flex-col">
      <ChartHeader symbol={symbol} onSelectToken={onSelectToken} />

      {/* Period selector toolbar */}
      <div
        ref={toolbarRef}
        className="relative flex gap-1 border-b border-border px-3 py-1.5"
        role="group"
        aria-label="Chart timeframe selection"
        onKeyDown={handleKeyDown}
      >
        {indicatorStyle && (
          <div
            role="presentation"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: indicatorStyle.width,
            }}
            className="absolute top-1.5 bottom-1.5 left-0 rounded bg-primary transition-[transform,width] duration-base ease-spring-smooth motion-reduce:transition-none pointer-events-none"
          />
        )}
        {PERIODS.map((p) => (
          <button
            key={p}
            ref={(el) => {
              if (el) buttonRefs.current.set(p, el)
              else buttonRefs.current.delete(p)
            }}
            onClick={() => handlePeriodChange(p)}
            aria-pressed={period === p}
            aria-label={`${p} timeframe`}
            title={`Switch to ${p} chart (${p === period ? "current" : ""})`}
            className={cn(
              "relative z-10 rounded px-2 py-0.5 font-mono text-xs transition-colors duration-fast ease-spring-snappy",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              period === p
                ? "text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="min-h-0 flex-1">
        {symbol ? (
          <TVChartContainer symbol={symbol} period={period} />
        ) : (
          <div role="status" className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a market
          </div>
        )}
      </div>
    </div>
  )
}
