import { useTradeFees } from "../../hooks/useTradeFees"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { estimateLiquidationPrice, formatUsd } from "../../lib/trade-math"
import { getEstimatedEntryPrice, getPriceImpactPct } from "../../lib/pricing"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
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
  const fees = useTradeFees({ sizeUsd, marketAddress, isIncrease: true, tradeType })

  const isLong = tradeType === "Long"
  const entryPrice = getMidPrice(toTokenAddress)
  const priceImpactPct = getPriceImpactPct(sizeUsd, fees.priceImpactUsd)
  const estimatedEntryPrice = getEstimatedEntryPrice(entryPrice, priceImpactPct, isLong)

  const liquidationPrice =
    sizeUsd > 0 && estimatedEntryPrice > 0
      ? estimateLiquidationPrice({
          entryPrice: estimatedEntryPrice,
          collateralUsd: sizeUsd / leverage,
          sizeUsd,
          isLong,
        })
      : 0

  const executionFeeDisplay = fees.executionFeeXlm > 0
    ? `~${fees.executionFeeXlm.toFixed(2)} XLM (${formatUsd(fees.executionFeeUsd)})`
    : "-"

  if (tradeType === "Swap") {
    return (
      <div className="space-y-1 text-xs">
        <Row label="Min. receive" value="-" />
        <Row label="Swap fee" value={formatUsd(fees.positionFeeUsd)} />
        <Row label="Price impact" value={formatUsd(fees.priceImpactUsd)} highlight={fees.priceImpactUsd < 0} />
        <ExecutionFeeRow value={executionFeeDisplay} />
      </div>
    )
  }

  return (
    <div className="space-y-1 text-xs">
      <Row label="Entry price" value={estimatedEntryPrice > 0 ? formatUsd(estimatedEntryPrice) : "-"} />
      {tradeMode === "Limit" && <Row label="Limit price" value="-" />}
      <Row label="Liq. price" value={liquidationPrice > 0 ? formatUsd(liquidationPrice) : "-"} highlight />
      <Row label="Position fee" value={formatUsd(fees.positionFeeUsd)} />
      <Row label="Price impact" value={`${priceImpactPct.toFixed(2)}%`} highlight={Math.abs(priceImpactPct) > 0.5} />
      <ExecutionFeeRow value={executionFeeDisplay} />
      <div className="border-t border-border pt-1">
        <Row label="Total fees" value={formatUsd(fees.totalFeesUsd)} bold />
      </div>
    </div>
  )
}

function ExecutionFeeRow({ value }: { value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">
        <Tooltip>
          <TooltipTrigger className="underline decoration-dotted underline-offset-2 cursor-help">Execution fee</TooltipTrigger>
          <TooltipContent side="top" className="max-w-48 text-xs">
            Paid to network keepers who execute your order.
          </TooltipContent>
        </Tooltip>
      </span>
      <span>{value}</span>
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
