import { useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../../lib/query-keys"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
import type { Period } from "../../store/chart-preferences-store"
import { ChartHeader } from "./ChartHeader"
import { TVChartContainer } from "./TVChartContainer"
import { cn } from "@workspace/ui/lib/utils"

const PERIODS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const

type Props = {
  symbol: string | undefined
  onSelectToken: (address: string) => void
}

export function TVChart({ symbol, onSelectToken }: Props) {
  const period = useChartPreferencesStore((s) => s.period)
  const setPeriod = useChartPreferencesStore((s) => s.setPeriod)
  const queryClient = useQueryClient()
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
    } else if (e.key === "ArrowRight") {
      nextIndex = currentIndex < PERIODS.length - 1 ? currentIndex + 1 : 0
    }

    const nextPeriod = PERIODS[nextIndex]
    handlePeriodChange(nextPeriod)

    // Focus the next button after render
    setTimeout(() => {
      buttonRefs.current.get(nextPeriod)?.focus()
    }, 0)
  }

  return (
    <div className="flex h-full flex-col">
      <ChartHeader symbol={symbol} onSelectToken={onSelectToken} />

      {/* Period selector toolbar */}
      <div
        className="flex gap-1 border-b border-border px-3 py-1.5"
        role="group"
        aria-label="Chart timeframe selection"
        onKeyDown={handleKeyDown}
      >
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
              "rounded px-2 py-0.5 font-mono text-xs transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              period === p
                ? "bg-primary text-primary-foreground"
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
