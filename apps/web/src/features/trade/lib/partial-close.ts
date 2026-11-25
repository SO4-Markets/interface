import type { Position } from "../hooks/usePositions"

export const PARTIAL_CLOSE_PRESETS = [25, 50, 75, 100] as const
export type PartialClosePreset = (typeof PARTIAL_CLOSE_PRESETS)[number]

export type ClosePreview = {
  hasValidSize: boolean
  closeRatio: number
  closedSizeUsd: number
  remainingSizeUsd: number
  remainingCollateralUsd: number
  estimatedPnlUsd: number
  estimatedGrossPnlUsd: number
  estimatedFundingShareUsd: number
  estimatedPnlPct: number
}

/**
 * Format a partial-close percentage preset into an input string while
 * preserving sub-cent precision when a position size is not an even cent
 * multiple (e.g. $100.333333 × 25% = "25.083333"), and keeping clean 2-decimal
 * formatting for whole-cent sizes (e.g. $50,000 × 25% = "12500.00").
 */
export function formatPartialPresetUsd(sizeUsd: number, percent: number): string {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return ""
  if (!Number.isFinite(percent) || percent <= 0) return ""

  const amount = (sizeUsd * percent) / 100
  if (Math.abs(amount - Number(amount.toFixed(2))) < 1e-9) {
    return amount.toFixed(2)
  }

  return amount.toFixed(6).replace(/(\.\d{2,}?)0+$/, "$1")
}

/**
 * Estimate realized PnL and remaining position exposure for a full or partial
 * close using the position's proportional net PnL and collateral.
 */
export function estimateClosePreview(
  position: Pick<
    Position,
    "sizeUsd" | "collateralUsd" | "pnl" | "pnlAfterFees" | "pnlPercent" | "fundingFeeUsd"
  >,
  closeSizeUsd: number,
  isFull: boolean,
): ClosePreview {
  const sizeUsd = Number.isFinite(position.sizeUsd) && position.sizeUsd > 0 ? position.sizeUsd : 0
  const validPartial =
    !isFull && Number.isFinite(closeSizeUsd) && closeSizeUsd > 0 && closeSizeUsd < sizeUsd
  const hasValidSize = sizeUsd > 0 && (isFull || validPartial)

  if (!hasValidSize) {
    return {
      hasValidSize: false,
      closeRatio: 0,
      closedSizeUsd: 0,
      remainingSizeUsd: sizeUsd,
      remainingCollateralUsd: Math.max(0, position.collateralUsd),
      estimatedPnlUsd: 0,
      estimatedGrossPnlUsd: 0,
      estimatedFundingShareUsd: 0,
      estimatedPnlPct: position.pnlPercent,
    }
  }

  const closeRatio = isFull ? 1 : closeSizeUsd / sizeUsd
  const closedSizeUsd = isFull ? sizeUsd : closeSizeUsd
  const remainingSizeUsd = isFull ? 0 : Math.max(0, sizeUsd - closedSizeUsd)
  const remainingCollateralUsd = isFull
    ? 0
    : Math.max(0, position.collateralUsd * (1 - closeRatio))

  return {
    hasValidSize: true,
    closeRatio,
    closedSizeUsd,
    remainingSizeUsd,
    remainingCollateralUsd,
    estimatedPnlUsd: position.pnlAfterFees * closeRatio,
    estimatedGrossPnlUsd: position.pnl * closeRatio,
    estimatedFundingShareUsd: position.fundingFeeUsd * closeRatio,
    estimatedPnlPct: position.pnlPercent,
  }
}
