import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Numeric } from "@workspace/ui/components/numeric"
import { useTradeFees } from "../../hooks/useTradeFees"
import { useFundingRate } from "../../hooks/useFundingRate"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { getEstimatedEntryPrice, getPriceImpactPct } from "../../lib/pricing"
import { estimatePositionRisk } from "../../lib/risk"
import { formatPrecisePct, formatPreciseUsd, formatPreciseXlm } from "../../lib/fee-breakdown"
import { FundingRate } from "../FundingRate"
import { TradeFeeBreakdown } from "./TradeFeeBreakdown"
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
  const fundingQuery = useFundingRate(marketAddress)
  const fundingRate = fundingQuery.data ?? null
  const fundingLoading = fundingQuery.isLoading
  const fundingUnavailable = Boolean(fundingQuery.isError) || (!fundingLoading && !fundingRate)
  const fees = useTradeFees({
    sizeUsd,
    marketAddress,
    isIncrease: true,
    tradeType,
    referencePrice: getMidPrice(toTokenAddress),
  })

  const isLong = tradeType === "Long"
  const entryPrice = getMidPrice(toTokenAddress)
  const priceImpactPct =
    fees.priceImpactPct !== undefined
      ? fees.priceImpactPct
      : getPriceImpactPct(sizeUsd, fees.priceImpactUsd)
  const estimatedEntryPrice = getEstimatedEntryPrice(entryPrice, priceImpactPct, isLong)

  const positionEstimate =
    riskParams && sizeUsd > 0 && estimatedEntryPrice !== null && estimatedEntryPrice > 0
      ? estimatePositionRisk({
          entryPrice: estimatedEntryPrice,
          collateralUsd: leverage > 0 ? sizeUsd / leverage : 0,
          leverage,
          isLong,
          risk: riskParams,
          existing: existingExposure,
        })
      : null

  const executionFeeDisplay = fees.isLoading
    ? "Loading…"
    : typeof fees.executionFeeXlm === "number" && typeof fees.executionFeeUsd === "number"
      ? `${formatPreciseXlm(fees.executionFeeXlm)} (${formatPreciseUsd(fees.executionFeeUsd)})`
      : typeof fees.executionFeeXlm === "number"
        ? formatPreciseXlm(fees.executionFeeXlm)
        : "Unavailable"

  if (tradeType === "Swap") {
    return (
      <div className="min-w-0 space-y-2 overflow-x-hidden text-xs">
        <div className="space-y-1">
          <Row label="Min. receive" value="-" />
          <Row label="Swap fee" value={fees.isLoading ? "Loading…" : formatPreciseUsd(fees.positionFeeUsd)} />
          <Row label="Price impact" value={fees.isLoading ? "Loading…" : formatPreciseUsd(fees.priceImpactUsd)} />
          <ExecutionFeeRow value={executionFeeDisplay} />
        </div>
        <TradeFeeBreakdown
          tradeType={tradeType}
          sizeUsd={sizeUsd}
          fees={fees}
          priceImpactPct={priceImpactPct}
        />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-2 overflow-x-hidden text-xs">
      <div className="space-y-1">
        <Row
          label="Entry price estimate"
          value={
            estimatedEntryPrice !== null && estimatedEntryPrice > 0 ? (
              <Numeric value={estimatedEntryPrice} format="usd" role="neutral" />
            ) : (
              "Unavailable"
            )
          }
        />
        {tradeMode === "Limit" && <Row label="Limit trigger" value="Not guaranteed to fill" />}
        <Row
          label="Notional estimate"
          value={positionEstimate ? <Numeric value={positionEstimate.notionalUsd} format="usd" role="neutral" /> : "Unavailable"}
        />
        <Row
          label="Margin estimate"
          value={positionEstimate ? <Numeric value={positionEstimate.collateralUsd} format="usd" role="neutral" /> : "Unavailable"}
        />
        <Row
          label="Liquidation estimate"
          value={
            positionEstimate?.liquidationPrice && positionEstimate.liquidationPrice > 0 ? (
              <Numeric value={positionEstimate.liquidationPrice} format="usd" role="danger" />
            ) : (
              "Unavailable"
            )
          }
        />
        <Row
          label="Funding"
          value={
            fundingLoading
              ? "Loading…"
              : fundingRate
                ? <FundingRate {...fundingRate} />
                : "Unavailable"
          }
        />
        <Row
          label="Position fee"
          value={fees.isLoading ? "Loading…" : formatPreciseUsd(fees.positionFeeUsd)}
        />
        <Row
          label="Price impact"
          value={fees.isLoading ? "Loading…" : formatPrecisePct(priceImpactPct)}
          highlight={priceImpactPct !== null && Math.abs(priceImpactPct) > 0.5}
        />
        <ExecutionFeeRow value={executionFeeDisplay} />
        <div className="border-t border-border pt-1">
          <Row
            label="Total fees"
            value={fees.isLoading ? "Loading…" : formatPreciseUsd(fees.totalFeesUsd)}
            bold
          />
        </div>
      </div>

      <TradeFeeBreakdown
        tradeType={tradeType}
        sizeUsd={sizeUsd}
        fees={fees}
        priceImpactPct={priceImpactPct}
        fundingRate={fundingRate}
        fundingLoading={fundingLoading}
        fundingUnavailable={fundingUnavailable}
      />
    </div>
  )
}

function ExecutionFeeRow({ value }: { value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">
        <Tooltip>
          <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
            Execution fee
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-48 text-xs">
            Paid to network keepers who execute your order.
          </TooltipContent>
        </Tooltip>
      </span>
      <span className="min-w-0 truncate text-right font-mono tabular-nums">{value}</span>
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
      <span className={`min-w-0 truncate text-right ${highlight ? "text-warning" : ""}`}>
        {value}
      </span>
    </div>
  )
}
