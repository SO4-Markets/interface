import { useId, useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import {
  TRADE_FEE_DOCS,
  describeFeeAvailability,
  estimateFundingCost8h,
  formatFeeRateBps,
  formatPrecisePct,
  formatPreciseUsd,
  formatPreciseXlm,
} from "../../lib/fee-breakdown"
import { FundingRate } from "../FundingRate"
import type { TradeFees } from "../../hooks/useTradeFees"
import type { FundingRateInfo } from "../../hooks/useFundingRate"

type Props = {
  tradeType: "Long" | "Short" | "Swap"
  sizeUsd: number
  fees: TradeFees
  priceImpactPct: number | null
  fundingRate?: FundingRateInfo | null
  fundingLoading?: boolean
  fundingUnavailable?: boolean
  defaultExpanded?: boolean
}

export function TradeFeeBreakdown({
  tradeType,
  sizeUsd,
  fees,
  priceImpactPct,
  fundingRate = null,
  fundingLoading = false,
  fundingUnavailable = false,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const panelId = useId()

  const isSwap = tradeType === "Swap"
  const isLoading = fees.isLoading ?? false
  const status = fees.status
  const availability = describeFeeAvailability({
    isLoading,
    sizeUsd,
    status,
  })

  const rateLabel = formatFeeRateBps(fees.feeBps)
  const funding8hUsd = !isSwap
    ? estimateFundingCost8h(sizeUsd, fundingRate?.ratePerHour)
    : null

  const summaryText = isLoading
    ? "Loading…"
    : fees.totalFeesUsd !== null
      ? formatPreciseUsd(fees.totalFeesUsd)
      : availability.state === "empty"
        ? "Enter amount"
        : "Unavailable"

  const priceImpactText = isLoading
    ? null
    : priceImpactPct !== null
      ? `${formatPrecisePct(priceImpactPct)}${
          fees.priceImpactUsd !== null ? ` (${formatPreciseUsd(fees.priceImpactUsd)})` : ""
        }`
      : status === "insufficient"
        ? "Insufficient depth"
        : status === "stale"
          ? "Stale depth"
          : "Unavailable"

  const executionCostText = isLoading
    ? null
    : typeof fees.executionFeeXlm === "number"
      ? typeof fees.executionFeeUsd === "number"
        ? `${formatPreciseXlm(fees.executionFeeXlm)} (${formatPreciseUsd(fees.executionFeeUsd)})`
        : `${formatPreciseXlm(fees.executionFeeXlm)} (USD unavailable)`
      : "Unavailable"

  return (
    <div className="rounded-md border border-border bg-surface-sunken text-xs">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        className="touch-target flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-start transition-colors hover:bg-surface-interactive focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="font-medium text-text-primary">
          Fee &amp; cost breakdown
        </span>
        <span className="flex items-center gap-1.5 font-mono tabular-nums text-text-secondary">
          <span>{summaryText}</span>
          <span aria-hidden="true">{expanded ? "▲" : "▼"}</span>
        </span>
      </button>

      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-label="Trade fee breakdown"
          className="space-y-2.5 border-t border-border px-2.5 py-2.5"
        >
          {isLoading ? (
            <div role="status" aria-label="Loading trade fee breakdown" className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-4/5" />
              <span className="sr-only">Loading fee breakdown…</span>
            </div>
          ) : (
            <p
              role="status"
              className={cn(
                "text-11",
                availability.state === "stale" || availability.state === "insufficient"
                  ? "text-warning"
                  : "text-text-secondary",
              )}
            >
              {availability.message}
            </p>
          )}

          <dl className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-secondary">
                {isSwap ? "Swap fee" : "Position fee"}
                {rateLabel ? ` (${rateLabel})` : ""}
              </dt>
              <dd className="font-mono tabular-nums text-right text-text-primary">
                {isLoading ? (
                  <Skeleton className="inline-block h-3.5 w-16" />
                ) : (
                  formatPreciseUsd(fees.positionFeeUsd)
                )}
              </dd>
            </div>

            {!isSwap && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Funding (rate / 8h est.)</dt>
                <dd className="font-mono tabular-nums text-right text-text-primary">
                  {fundingLoading ? (
                    <span role="status" aria-label="Loading funding rate">
                      <Skeleton className="inline-block h-3.5 w-20" />
                    </span>
                  ) : fundingUnavailable || !fundingRate ? (
                    <span className="text-text-secondary">Unavailable</span>
                  ) : (
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <FundingRate {...fundingRate} />
                      {funding8hUsd !== null && (
                        <span className="text-10 text-text-secondary">
                          8h est.: {formatPreciseUsd(funding8hUsd)}
                        </span>
                      )}
                    </span>
                  )}
                </dd>
              </div>
            )}

            {!isSwap && typeof fees.borrowingRatePerHour === "number" && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Borrow rate</dt>
                <dd className="font-mono tabular-nums text-right text-text-primary">
                  {formatPrecisePct(fees.borrowingRatePerHour * 100)}/h
                </dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-secondary">Price impact</dt>
              <dd
                className={cn(
                  "font-mono tabular-nums text-right",
                  priceImpactPct !== null && Math.abs(priceImpactPct) > 0.5
                    ? "text-danger"
                    : "text-text-primary",
                )}
              >
                {isLoading ? (
                  <Skeleton className="inline-block h-3.5 w-16" />
                ) : (
                  priceImpactText
                )}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-secondary">Execution cost</dt>
              <dd className="font-mono tabular-nums text-right text-text-primary">
                {isLoading ? (
                  <Skeleton className="inline-block h-3.5 w-24" />
                ) : (
                  executionCostText
                )}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 font-medium">
              <dt className="text-text-primary">Estimated upfront cost</dt>
              <dd className="font-mono tabular-nums text-right text-text-primary">
                {isLoading ? (
                  <Skeleton className="inline-block h-3.5 w-16" />
                ) : (
                  formatPreciseUsd(fees.totalFeesUsd)
                )}
              </dd>
            </div>
          </dl>

          {!isSwap && (
            <p className="text-11 text-text-secondary">
              Funding and borrowing costs vary while the position is open and are excluded from the upfront estimate.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2">
            <a
              href={TRADE_FEE_DOCS.overview.href}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center text-11 font-medium text-text-link underline-offset-2 hover:underline"
            >
              {TRADE_FEE_DOCS.overview.label}
            </a>
            <a
              href={TRADE_FEE_DOCS.liquidation.href}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center text-11 font-medium text-text-link underline-offset-2 hover:underline"
            >
              {TRADE_FEE_DOCS.liquidation.label}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
