import { useQuery } from "@tanstack/react-query"
import { fetchFeeConfig } from "../lib/data-store"
import { queryKeys } from "../lib/query-keys"
import { useTokenPrices } from "./useTokenPrices"

const PRICE_IMPACT_BPS = 5

export type TradeFees = {
  positionFeeUsd: number
  priceImpactUsd: number
  executionFeeUsd: number
  executionFeeXlm: number
  totalFeesUsd: number
  feesBreakdown: Array<{ label: string; valueUsd: number }>
}

const CHAIN_ID = "stellar-mainnet"

export function useTradeFees(params: {
  sizeUsd: number
  marketAddress: string
  isIncrease: boolean
  tradeType?: "Long" | "Short" | "Swap"
}): TradeFees {
  const { sizeUsd, marketAddress, tradeType = "Long" } = params

  const { data: feeConfig } = useQuery({
    queryKey: queryKeys.feeConfig(CHAIN_ID, marketAddress),
    queryFn: () => fetchFeeConfig(marketAddress),
    staleTime: 120_000,
    enabled: !!marketAddress,
  })

  const { getMidPrice } = useTokenPrices()
  const xlmPrice = getMidPrice("XLM")

  if (!sizeUsd || sizeUsd <= 0) {
    return {
      positionFeeUsd: 0,
      priceImpactUsd: 0,
      executionFeeUsd: 0,
      executionFeeXlm: 0,
      totalFeesUsd: 0,
      feesBreakdown: [],
    }
  }

  const feeBps =
    tradeType === "Swap"
      ? (feeConfig?.swapFeeBps ?? 10)
      : (feeConfig?.positionFeeBps ?? 10)

  const executionFeeXlm = feeConfig?.minExecutionFeeXlm ?? 0.3
  const executionFeeUsd = executionFeeXlm * (xlmPrice || 0.17)

  const positionFeeUsd = (sizeUsd * feeBps) / 10_000
  const priceImpactUsd = -(sizeUsd * PRICE_IMPACT_BPS) / 10_000

  const totalFeesUsd = positionFeeUsd + Math.abs(priceImpactUsd) + executionFeeUsd

  return {
    positionFeeUsd,
    priceImpactUsd,
    executionFeeUsd,
    executionFeeXlm,
    totalFeesUsd,
    feesBreakdown: [
      { label: tradeType === "Swap" ? "Swap fee" : "Position fee", valueUsd: positionFeeUsd },
      { label: "Price impact", valueUsd: priceImpactUsd },
      { label: "Execution fee", valueUsd: executionFeeUsd },
    ],
  }
}
