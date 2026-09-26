/**
 * apps/web/src/features/trade/hooks/usePositionsWithIndexer.ts
 *
 * Priced position bundle: slowly changing state (see `usePositionState`) joined
 * with oracle-derived values.
 *
 * Prefer `usePositionState` in new UI. This hook subscribes the calling
 * component to the price feed, so every oracle tick re-renders it — which is
 * exactly what the position table must avoid (OB-085). It is kept for callers
 * that genuinely render a whole priced row in one component.
 */

import { usePositionState } from "./usePositionState"
import { useTokenPrices } from "./useTokenPrices"
import type { Position } from "./usePositions"

export function usePositionsWithIndexer() {
  const { data: states = [], isLoading, isDisabled } = usePositionState()
  const { getMidPrice } = useTokenPrices()

  const positions: Array<Position> = states.map((state) => {
    const collateralPrice = getMidPrice(state.collateralToken)
    const collateralUsd =
      collateralPrice > 0
        ? state.collateralAmount * collateralPrice
        : state.sizeUsd * 0.01
    const leverage =
      collateralUsd > 0 ? Math.round(state.sizeUsd / collateralUsd) : 0
    const markPrice = getMidPrice(state.indexToken) || state.entryPrice
    const pnlAfterFees = state.pnlUsd - state.fundingFeeUsd
    const pnlPercent =
      collateralUsd > 0 ? (pnlAfterFees / collateralUsd) * 100 : 0

    return {
      key: state.key,
      account: state.account,
      marketAddress: state.marketAddress,
      marketName: state.marketName,
      indexToken: state.indexToken,
      collateralToken: state.collateralToken,
      collateralAmount: state.collateralAmount,
      collateralUsd,
      sizeUsd: state.sizeUsd,
      sizeInUsdRaw: state.sizeInUsdRaw,
      entryPrice: state.entryPrice,
      markPrice,
      liquidationPrice: state.liquidationPriceUsd,
      leverage,
      pnl: state.pnlUsd,
      pnlPercent,
      isLong: state.isLong,
      pnlAfterFees,
      fundingFeeUsd: state.fundingFeeUsd,
    }
  })

  return {
    data: positions,
    isLoading,
    isDisabled,
  }
}
