import { usePriceDelta24h } from "../../hooks/usePriceDelta24h"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { MarketSelector } from "./MarketSelector"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  onSelectToken: (address: string) => void
}

export function ChartHeader({ symbol, onSelectToken }: Props) {
  const { getMidPrice } = useTokenPrices()
  const { data: delta } = usePriceDelta24h(symbol)

  const midPrice = symbol ? getMidPrice(symbol) : 0
  const isPositive = (delta?.deltaPercentage ?? 0) > 0
  const isNegative = (delta?.deltaPercentage ?? 0) < 0

  return (
    <div className="flex items-center gap-4 border-b border-border px-3 py-2 text-sm">
      {/* Market selector */}
      <MarketSelector symbol={symbol} onSelect={onSelectToken} />

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* Current price */}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Price</span>
        <span className="font-mono font-medium">
          {midPrice > 0 ? formatUsd(midPrice, { decimals: 4 }) : "—"}
        </span>
      </div>

      {/* 24h change */}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">24h Change</span>
        <span
          className={
            isPositive
              ? "font-mono text-green-500"
              : isNegative
                ? "font-mono text-red-500"
                : "font-mono text-muted-foreground"
          }
        >
          {delta?.deltaPercentageStr ?? "—"}
        </span>
      </div>

      {/* 24h High */}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">24h High</span>
        <span className="font-mono">
          {delta?.high ? formatUsd(delta.high, { decimals: 2 }) : "—"}
        </span>
      </div>

      {/* 24h Low */}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">24h Low</span>
        <span className="font-mono">
          {delta?.low ? formatUsd(delta.low, { decimals: 2 }) : "—"}
        </span>
      </div>
    </div>
  )
}
