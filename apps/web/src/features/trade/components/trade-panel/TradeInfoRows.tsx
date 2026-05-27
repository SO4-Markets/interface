import { useTradeFees } from "../../hooks/useTradeFees"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import {
  estimateLiquidationPrice,
  formatUsd,
} from "../../lib/trade-math"
import type { TradeState } from "../../hooks/useTradeState"

type Props = Pick<
  TradeState,
  "tradeType" | "toTokenAddress" | "marketAddress" | "leverage" | "fromAmount" | "tradeMode"
> & {
  sizeUsd: number
}

export function TradeInfoRows({
  tradeType,
  toTokenAddress,
  marketAddress,
  leverage,
  sizeUsd,
  tradeMode,
}: Props) {
  const { getMidPrice } = useTokenPrices()
  const fees = useTradeFees({
    sizeUsd,
    marketAddress,
    isIncrease: true,
    tradeType,
  })

  const isLong = tradeType === "Long"
  const entryPrice = getMidPrice(toTokenAddress)

  const liquidationPrice =
    sizeUsd > 0 && entryPrice > 0
      ? estimateLiquidationPrice({
          entryPrice,
          collateralUsd: sizeUsd / leverage,
          sizeUsd,
          isLong,
        })
      : 0

  if (tradeType === "Swap") {
    return (
      <div className="space-y-1 text-xs">
        <Row label="Min. receive" value="—" />
        <Row label="Swap fee" value={formatUsd(fees.positionFeeUsd)} />
        <Row label="Price impact" value={formatUsd(fees.priceImpactUsd)} highlight={fees.priceImpactUsd < 0} />
        <Row label="Execution fee" value={formatUsd(fees.executionFeeUsd)} />
      </div>
    )
  }

  return (
    <div className="space-y-1 text-xs">
      <Row label="Entry price" value={entryPrice > 0 ? formatUsd(entryPrice) : "—"} />
      {tradeMode === "Limit" && <Row label="Limit price" value="—" />}
      <Row
        label="Liq. price"
        value={liquidationPrice > 0 ? formatUsd(liquidationPrice) : "—"}
        highlight
      />
      <Row label="Position fee" value={formatUsd(fees.positionFeeUsd)} />
      <Row
        label="Price impact"
        value={formatUsd(fees.priceImpactUsd)}
        highlight={fees.priceImpactUsd < 0}
      />
      <Row label="Execution fee" value={formatUsd(fees.executionFeeUsd)} />
      <div className="border-t border-border pt-1">
        <Row label="Total fees" value={formatUsd(fees.totalFeesUsd)} bold />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  bold,
}: {
  label: string
  value: string
  highlight?: boolean
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-medium" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-amber-500" : ""}>{value}</span>
    </div>
  )
}
