import { useQuery } from "@tanstack/react-query"
import { fetchFeeConfig } from "../lib/data-store"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { useTokenPrices } from "./useTokenPrices"
import { calculateDepthImpact, type VerifiedDepth } from "../lib/fee-preview"

export type TradeFees = {
  positionFeeUsd: number | null
  priceImpactUsd: number | null
  executionFeeUsd: number | null
  executionFeeXlm: number | null
  totalFeesUsd: number | null
  status: "estimated" | "unknown" | "stale" | "insufficient"
  feesBreakdown: Array<{ label: string; valueUsd: number | null }>
}

const CHAIN_ID = activeQueryNetwork()
const FEE_CONFIG_MAX_AGE_MS = 120_000

export function useTradeFees(params: {
  sizeUsd: number
  marketAddress: string
  isIncrease: boolean
  tradeType?: "Long" | "Short" | "Swap"
  depth?: VerifiedDepth | null
  referencePrice?: number
}): TradeFees {
  const { sizeUsd, marketAddress, tradeType = "Long" } = params

  const { data: feeConfig } = useQuery({
    queryKey: queryKeys.trade.feeConfig(CHAIN_ID, marketAddress),
    queryFn: () => fetchFeeConfig(marketAddress),
    staleTime: 120_000,
    enabled: !!marketAddress,
  })

  const { getMidPrice } = useTokenPrices()
  const xlmPrice = getMidPrice("XLM")

  if (!sizeUsd || sizeUsd <= 0) {
    return {
      positionFeeUsd: null,
      priceImpactUsd: null,
      executionFeeUsd: null,
      executionFeeXlm: null,
      totalFeesUsd: null,
      status: "unknown",
      feesBreakdown: [],
    }
  }

  if (!feeConfig || feeConfig.source !== "verified") {
    return {
      positionFeeUsd: null,
      priceImpactUsd: null,
      executionFeeUsd: null,
      executionFeeXlm: null,
      totalFeesUsd: null,
      status: "unknown",
      feesBreakdown: [],
    }
  }

  if (!Number.isFinite(feeConfig.updatedAt) || Date.now() - feeConfig.updatedAt > FEE_CONFIG_MAX_AGE_MS) {
    return {
      positionFeeUsd: null,
      priceImpactUsd: null,
      executionFeeUsd: null,
      executionFeeXlm: null,
      totalFeesUsd: null,
      status: "stale",
      feesBreakdown: [],
    }
  }

  const feeBps =
    tradeType === "Swap"
      ? (feeConfig?.swapFeeBps ?? 10)
      : (feeConfig?.positionFeeBps ?? 10)

  const executionFeeXlm = feeConfig?.minExecutionFeeXlm ?? 0.3
  const executionFeeUsd = xlmPrice > 0 ? executionFeeXlm * xlmPrice : null

  const positionFeeUsd = (sizeUsd * feeBps) / 10_000
  const depthImpact = calculateDepthImpact({
    side: tradeType === "Short" ? "short" : "long",
    orderValueUsd: sizeUsd,
    referencePrice: params.referencePrice ?? 0,
    depth: params.depth,
  })
  const priceImpactUsd = depthImpact.impactPct === null ? null : (sizeUsd * depthImpact.impactPct) / 100

  const totalFeesUsd = priceImpactUsd === null || executionFeeUsd === null
    ? null
    : positionFeeUsd + priceImpactUsd + executionFeeUsd

  return {
    positionFeeUsd,
    priceImpactUsd,
    executionFeeUsd,
    executionFeeXlm,
    totalFeesUsd,
    status: depthImpact.status,
    feesBreakdown: [
      { label: tradeType === "Swap" ? "Swap fee" : "Position fee", valueUsd: positionFeeUsd },
      { label: "Price impact", valueUsd: priceImpactUsd },
      { label: "Execution fee", valueUsd: executionFeeUsd },
    ],
  }
}
