import { usePriceDelta24h } from "../../hooks/usePriceDelta24h"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { useMarketsInfo } from "../../hooks/useMarketsInfo"
import { OracleStalenessIndicator } from "../OracleStalenessIndicator"
import { MarketStatsHeader } from "../MarketStatsHeader"
import { MarketSelector } from "./MarketSelector"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  onSelectToken: (address: string) => void
}

export function ChartHeader({ symbol, onSelectToken }: Props) {
  const { getMidPrice, getStaleness } = useTokenPrices()
  const { data: delta } = usePriceDelta24h(symbol)
  const { marketsInfo, getMarket } = useMarketsInfo()
  const market = marketsInfo.find((entry) => entry.indexTokenAddress === symbol)
  const info = market ? getMarket(market.address) : undefined

  const midPrice = symbol ? getMidPrice(symbol) : 0
  const staleness = symbol ? getStaleness(symbol) : "stale"
  const isPositive = (delta?.deltaPercentage ?? 0) > 0
  const isNegative = (delta?.deltaPercentage ?? 0) < 0

  return (
    <div className="border-b border-border">
      <div className="flex min-w-0 items-center gap-4 overflow-x-auto px-3 py-2 text-sm">
      {/* Market selector */}
      <MarketSelector
        symbol={symbol}
        onSelect={onSelectToken}
      />

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* Current price */}
      <div className="flex shrink-0 flex-col">
        <span className="text-xs text-muted-foreground">Price</span>
        <span className="flex items-center gap-2 font-mono font-medium">
          {symbol && <OracleStalenessIndicator staleness={staleness} showLabel />}
          {midPrice > 0 ? formatUsd(midPrice, { decimals: 4 }) : "—"}
        </span>
      </div>

      {/* 24h change */}
      <div className="flex shrink-0 flex-col">
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
      <div className="flex shrink-0 flex-col">
        <span className="text-xs text-muted-foreground">24h High</span>
        <span className="font-mono">
          {delta?.high ? formatUsd(delta.high, { decimals: 2 }) : "—"}
        </span>
      </div>

      {/* 24h Low */}
      <div className="flex shrink-0 flex-col">
        <span className="text-xs text-muted-foreground">24h Low</span>
        <span className="font-mono">
          {delta?.low ? formatUsd(delta.low, { decimals: 2 }) : "—"}
        </span>
      </div>
      </div>
      <MarketStatsHeader
        marketName={market?.name}
        volume24h={undefined}
        openInterest={info ? info.openInterestLong + info.openInterestShort : undefined}
        markPrice={midPrice || undefined}
        indexPrice={midPrice || undefined}
        fundingRate={undefined}
      />
    </div>
  )
}
