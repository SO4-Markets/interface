import { Meter } from "@workspace/ui/components/meter"
import { Numeric } from "@workspace/ui/components/numeric"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  RISK_SOURCE_LABEL,
  describePositionRisk,
  describePositionRiskMeter,
  pickHighestRiskPosition,
  riskSeverity,
} from "../../lib/position-risk"
import type { StatusVariant } from "@workspace/ui/components/status-badge"
import type { Position } from "../../hooks/usePositions"
import type { OracleStaleness } from "../../lib/pyth"
import type { LiquidationRiskLevel, PositionRiskReading } from "../../lib/position-risk"
import { formatUsd } from "@/shared/lib/format"

const BADGE_VARIANT: Record<LiquidationRiskLevel, StatusVariant> = {
  safe: "success",
  warning: "warning",
  danger: "danger",
  unavailable: "muted",
}

const SUMMARY_CONTAINER_STYLES: Record<LiquidationRiskLevel, string> = {
  safe: "border-border bg-surface-raised",
  warning: "border-warning-border bg-warning-subtle",
  danger: "border-danger-border bg-danger-subtle",
  unavailable: "border-border bg-surface-sunken",
}

type RowMeterProps = {
  marketName: string
  isLong: boolean
  reading: PositionRiskReading
}

/**
 * Compact inline liquidation risk meter for a position row.
 * Pairs the visual Meter with an explicit text status, distance %, and USD buffer.
 */
export function PositionRiskMeter({ marketName, isLong, reading }: RowMeterProps) {
  const meter = describePositionRiskMeter(reading)
  const sideLabel = isLong ? "long" : "short"

  if (!reading.hasData) {
    return (
      <div className="flex min-w-28 flex-col items-start gap-1">
        <Meter
          size="sm"
          value={0}
          min={0}
          max={100}
          threshold="neutral"
          label={`Liquidation risk for ${marketName} ${sideLabel}`}
          aria-valuetext={meter.description}
        />
        <StatusBadge variant="muted">No data</StatusBadge>
      </div>
    )
  }

  return (
    <div className="flex min-w-32 flex-col items-start gap-1">
      <div className="flex w-full items-center justify-between gap-2">
        <Numeric
          value={reading.availableRiskUsd}
          format="usd"
          role={riskSeverity(reading)}
        />
        <StatusBadge variant={BADGE_VARIANT[meter.level]}>
          {meter.statusLabel}
        </StatusBadge>
      </div>
      <Meter
        size="sm"
        value={meter.riskScore}
        min={0}
        max={100}
        threshold={meter.threshold}
        label={`Liquidation risk for ${marketName} ${sideLabel}`}
        aria-valuetext={meter.description}
      />
      <span className="text-10 text-text-secondary">
        {meter.distanceText} to liq. ·{" "}
        {reading.isStale ? "Stale oracle" : RISK_SOURCE_LABEL[reading.source]} Est.
      </span>
    </div>
  )
}

type SummaryProps = {
  positions: ReadonlyArray<Position>
  isLoading: boolean
  isDisconnected: boolean
  getStaleness: (symbol: string) => OracleStaleness
  selectedPositionKey?: string | null
}

/**
 * Summary position liquidation risk meter for the Positions workspace.
 * Explicitly models loading, disconnected, empty, safe, warning, danger,
 * stale, and unavailable states using semantic design tokens and text equivalents.
 */
export function PositionLiquidationRiskSummary({
  positions,
  isLoading,
  isDisconnected,
  getStaleness,
  selectedPositionKey,
}: SummaryProps) {
  if (isLoading && positions.length === 0) {
    return (
      <section
        aria-label="Position liquidation risk"
        className="border-b border-border bg-surface-raised px-4 py-3"
      >
        <div
          role="status"
          aria-label="Loading position liquidation risk"
          className="space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary">
              Loading liquidation risk…
            </span>
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </section>
    )
  }

  if (isDisconnected) {
    return (
      <section
        aria-label="Position liquidation risk"
        className="border-b border-border bg-surface-sunken px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              Liquidation risk
            </span>
            <StatusBadge variant="muted">Disconnected</StatusBadge>
          </div>
          <span className="text-xs text-text-secondary">
            Connect your wallet to monitor position health.
          </span>
        </div>
        <Meter
          size="md"
          value={0}
          min={0}
          max={100}
          threshold="neutral"
          label="Position liquidation risk (wallet disconnected)"
          aria-valuetext="Wallet disconnected — connect your wallet to monitor position liquidation risk"
          className="mt-2"
        />
      </section>
    )
  }

  if (positions.length === 0) {
    return (
      <section
        aria-label="Position liquidation risk"
        className="border-b border-border bg-surface-sunken px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              Liquidation risk
            </span>
            <StatusBadge variant="neutral">No positions</StatusBadge>
          </div>
          <span className="text-xs text-text-secondary">
            No open positions — no active liquidation exposure.
          </span>
        </div>
        <Meter
          size="md"
          value={0}
          min={0}
          max={100}
          threshold="neutral"
          label="Position liquidation risk (no open positions)"
          aria-valuetext="No open positions — no active liquidation exposure"
          className="mt-2"
        />
      </section>
    )
  }

  const selected = selectedPositionKey
    ? positions.find((p) => p.key === selectedPositionKey)
    : undefined

  const target = selected
    ? {
        position: selected,
        reading: describePositionRisk({
          sizeUsd: selected.sizeUsd,
          markPriceUsd: selected.markPrice,
          liquidationPriceUsd: selected.liquidationPrice,
          isLong: selected.isLong,
          markPriceStaleness: getStaleness(selected.indexToken),
        }),
      }
    : pickHighestRiskPosition(positions, getStaleness)

  if (!target) return null

  const { position, reading } = target
  const meter = describePositionRiskMeter(reading)
  const sideLabel = position.isLong ? "Long" : "Short"

  return (
    <section
      aria-label="Position liquidation risk"
      className={cn(
        "border-b px-4 py-3 transition-colors duration-base",
        SUMMARY_CONTAINER_STYLES[meter.level],
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-primary">
            Liquidation risk
          </span>
          <span className="text-xs text-text-secondary">
            {position.marketName} {sideLabel}
          </span>
          <StatusBadge variant={BADGE_VARIANT[meter.level]}>
            {meter.statusLabel}
          </StatusBadge>
          {reading.isStale && (
            <StatusBadge variant="warning">Stale oracle</StatusBadge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-text-secondary">
          {reading.hasData ? (
            <>
              <span>{meter.distanceText} to liq.</span>
              <span>
                Mark {formatUsd(position.markPrice)} · Liq.{" "}
                {formatUsd(position.liquidationPrice)}
              </span>
              <span>Buffer {formatUsd(reading.availableRiskUsd)} Est.</span>
            </>
          ) : (
            <span>Risk data unavailable</span>
          )}
        </div>
      </div>

      <Meter
        size="md"
        value={meter.riskScore}
        min={0}
        max={100}
        threshold={meter.threshold}
        label={`Liquidation risk for ${position.marketName} ${sideLabel}`}
        aria-valuetext={meter.description}
        className="mt-2"
      />

      {meter.level === "danger" && (
        <p role="status" className="mt-2 text-xs font-medium text-danger">
          Critical liquidation risk: {position.marketName} {sideLabel} is within{" "}
          {meter.distanceText} of liquidation. Add collateral or reduce size.
        </p>
      )}
      {meter.level === "warning" && (
        <p role="status" className="mt-2 text-xs font-medium text-warning">
          Elevated liquidation risk: {position.marketName} {sideLabel} is{" "}
          {meter.distanceText} from liquidation. Monitor mark price closely.
        </p>
      )}
      {reading.isStale && (
        <p role="status" className="mt-1 text-xs text-text-secondary">
          Oracle price is stale; displayed liquidation distance is an outdated estimate.
        </p>
      )}
    </section>
  )
}
