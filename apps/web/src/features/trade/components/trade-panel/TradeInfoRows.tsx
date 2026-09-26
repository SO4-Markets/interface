import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Numeric } from "@workspace/ui/components/numeric"
import { useTradeFees } from "../../hooks/useTradeFees"
import { useFundingRate } from "../../hooks/useFundingRate"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { getEstimatedEntryPrice, getPriceImpactPct } from "../../lib/pricing"
import { estimatePositionRisk } from "../../lib/risk"
import { FundingRate } from "../FundingRate"
import type { ReactNode } from "react"
import type { TradeState } from "../../hooks/useTradeState"
import type { ExistingExposure, MarketRiskParams } from "../../lib/risk"

type Props = Pick<
  TradeState,
  "tradeType" | "toTokenAddress" | "marketAddress" | "leverage" | "fromAmount" | "tradeMode"
> & {
  sizeUsd: number
  riskParams: MarketRiskParams | null
  existingExposure?: ExistingExposure
}

export function TradeInfoRows({
  tradeType,
  toTokenAddress,
  marketAddress,
  leverage,
  sizeUsd,
  tradeMode,
  riskParams,
  existingExposure,
}: Props) {
  const { getMidPrice } = useTokenPrices()
  const { data: fundingRate } = useFundingRate(marketAddress)
  const fees = useTradeFees({ sizeUsd, marketAddress, isIncrease: true, tradeType })

  const isLong = tradeType === "Long"
  const entryPrice = getMidPrice(toTokenAddress)
  const priceImpactPct = getPriceImpactPct(sizeUsd, fees.priceImpactUsd)
  const estimatedEntryPrice = getEstimatedEntryPrice(entryPrice, priceImpactPct, isLong)

  const positionEstimate = riskParams && sizeUsd > 0 && estimatedEntryPrice > 0
    ? estimatePositionRisk({
        entryPrice: estimatedEntryPrice,
        collateralUsd: leverage > 0 ? sizeUsd / leverage : 0,
        leverage,
        isLong,
        risk: riskParams,
        existing: existingExposure,
      })
    : null

  const executionFeeDisplay = fees.executionFeeXlm > 0
    ? <>~{fees.executionFeeXlm.toFixed(2)} XLM (<Numeric value={fees.executionFeeUsd} format="usd" role="neutral" />)</>
    : "-"

  if (tradeType === "Swap") {
    return (
      <div className="min-w-0 space-y-1 overflow-x-hidden text-xs">
        <Row label="Min. receive" value="-" />
        <Row label="Swap fee" value={<Numeric value={fees.positionFeeUsd} format="usd" role="neutral" />} />
        <Row label="Price impact" value={<Numeric value={fees.priceImpactUsd} format="usd" role={fees.priceImpactUsd < 0 ? "negative" : "neutral"} />} />
        <ExecutionFeeRow value={executionFeeDisplay} />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-1 overflow-x-hidden text-xs">
      <Row label="Entry price estimate" value={estimatedEntryPrice > 0 ? <Numeric value={estimatedEntryPrice} format="usd" role="neutral" /> : "-"} />
      {tradeMode === "Limit" && <Row label="Limit price" value="-" />}
      <Row label="Notional estimate" value={positionEstimate ? <Numeric value={positionEstimate.notionalUsd} format="usd" role="neutral" /> : "-"} />
      <Row label="Margin estimate" value={positionEstimate ? <Numeric value={positionEstimate.collateralUsd} format="usd" role="neutral" /> : "-"} />
      <Row
        label="Liquidation estimate"
        value={positionEstimate?.liquidationPrice && positionEstimate.liquidationPrice > 0
          ? <Numeric value={positionEstimate.liquidationPrice} format="usd" role="danger" />
          : "Unavailable"}
      />
      <Row
        label="Funding"
        value={
          fundingRate
            ? <FundingRate {...fundingRate} />
            : "-"
        }
      />
      <Row label="Position fee" value={<Numeric value={fees.positionFeeUsd} format="usd" role="neutral" />} />
      <Row label="Price impact" value={<Numeric value={priceImpactPct} format="pct" role={Math.abs(priceImpactPct) > 0.5 ? "danger" : "neutral"} />} />
      <ExecutionFeeRow value={executionFeeDisplay} />
      <div className="border-t border-border pt-1">
        <Row label="Total fees" value={<Numeric value={fees.totalFeesUsd} format="usd" role="neutral" />} bold />
      </div>
    </div>
  )
}

function ExecutionFeeRow({ value }: { value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">
        <Tooltip>
          <TooltipTrigger className="underline decoration-dotted underline-offset-2 cursor-help">Execution fee</TooltipTrigger>
          <TooltipContent side="top" className="max-w-48 text-xs">
            Paid to network keepers who execute your order.
          </TooltipContent>
        </Tooltip>
      </span>
      <span className="min-w-0 truncate text-right">{value}</span>
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
  value: ReactNode
  highlight?: boolean
  bold?: boolean
}) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 ${bold ? "font-medium" : ""}`}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right ${highlight ? "text-amber-500" : ""}`}>
        {value}
      </span>
    </div>
  )
}
