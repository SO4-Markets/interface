import { estimateLiquidationPrice } from "./liquidation"

export type MarketRiskParams = {
  maxLeverage: number
  maintenanceMarginRateBps: number | null
  updatedAt: number
}

export type ExistingExposure = {
  sizeUsd: number
  collateralUsd: number
  entryPrice: number
}

export type RiskState = "available" | "stale" | "unavailable"

export type PositionEstimate = {
  collateralUsd: number
  notionalUsd: number
  liquidationPrice: number | null
}

export const RISK_MAX_AGE_MS = 5 * 60 * 1000

export function getRiskState(
  params: MarketRiskParams | null | undefined,
  now = Date.now(),
  maxAgeMs = RISK_MAX_AGE_MS,
): RiskState {
  if (
    !params ||
    !Number.isFinite(params.maxLeverage) ||
    params.maxLeverage < 1 ||
    !Number.isFinite(params.updatedAt)
  ) return "unavailable"
  return now - params.updatedAt > maxAgeMs ? "stale" : "available"
}

export function clampLeverage(value: number, maxLeverage: number): number {
  if (!Number.isFinite(maxLeverage) || maxLeverage < 1) return 0
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(value, 1), maxLeverage)
}

export function estimatePositionRisk(params: {
  collateralUsd: number
  leverage: number
  entryPrice: number
  isLong: boolean
  risk: MarketRiskParams
  existing?: ExistingExposure | null
}): PositionEstimate | null {
  const { collateralUsd, entryPrice, isLong, risk, existing } = params
  const leverage = clampLeverage(params.leverage, risk.maxLeverage)
  if (
    getRiskState(risk) !== "available" ||
    leverage <= 0 ||
    collateralUsd <= 0 ||
    entryPrice <= 0
  ) return null

  const newNotionalUsd = collateralUsd * leverage
  const existingSize = existing && existing.sizeUsd > 0 ? existing.sizeUsd : 0
  const existingCollateral = existing && existing.collateralUsd > 0 ? existing.collateralUsd : 0
  const notionalUsd = existingSize + newNotionalUsd
  const totalCollateralUsd = existingCollateral + collateralUsd

  let liquidationPrice: number | null = null
  if (risk.maintenanceMarginRateBps !== null && Number.isFinite(risk.maintenanceMarginRateBps)) {
    const existingTokens = existing && existing.entryPrice > 0
      ? existingSize / existing.entryPrice
      : 0
    const newTokens = newNotionalUsd / entryPrice
    const averageEntryPrice = existingTokens + newTokens > 0
      ? notionalUsd / (existingTokens + newTokens)
      : entryPrice
    liquidationPrice = estimateLiquidationPrice({
      entryPrice: averageEntryPrice,
      collateralUsd: totalCollateralUsd,
      sizeUsd: notionalUsd,
      isLong,
      maintenanceMarginRateBps: risk.maintenanceMarginRateBps,
    })
  }

  return { collateralUsd, notionalUsd, liquidationPrice }
}
