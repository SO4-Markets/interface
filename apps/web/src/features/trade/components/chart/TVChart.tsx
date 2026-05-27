import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../../lib/query-keys"
import { ChartHeader } from "./ChartHeader"
import { TVChartContainer } from "./TVChartContainer"

const PERIODS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const
type Period = (typeof PERIODS)[number]

type Props = {
  symbol: string | undefined
  onSelectToken: (address: string) => void
}

export function TVChart({ symbol, onSelectToken }: Props) {
  const [period, setPeriod] = useState<Period>("5m")
  const queryClient = useQueryClient()

  // When the period changes, invalidate the candles cache so useOracleCandles refetches
  function handlePeriodChange(p: Period) {
    setPeriod(p)
    if (symbol) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.oracleCandles(symbol, p) })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ChartHeader symbol={symbol} onSelectToken={onSelectToken} />

      {/* Period selector */}
      <div className="flex gap-1 border-b border-border px-3 py-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
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
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a market
          </div>
        )}
      </div>
    </div>
  )
}
