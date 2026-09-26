import { useQuery } from "@tanstack/react-query"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { GET_MARKET_RISK_PARAMS } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { getRiskState } from "../lib/risk"
import type { MarketRiskParams, RiskState } from "../lib/risk"

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseTimestamp(value: Date | string | null | undefined): number {
  if (!value) return NaN
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : NaN
}

export type MarketRiskResult = {
  params: MarketRiskParams | null
  state: RiskState
  isLoading: boolean
  isError: boolean
}

export function useMarketRiskParams(marketKey: string): MarketRiskResult {
  const query = useQuery({
    queryKey: indexerQueryKeys.markets.risk(marketKey),
    queryFn: async (): Promise<MarketRiskParams> => {
      const result = await executeGraphQLQuery(GET_MARKET_RISK_PARAMS, { marketKey })
      const market = result.markets.nodes[0]
      const snapshot = market?.latestConfigSnapshot
      const maxLeverage = parsePositiveNumber(snapshot?.maxLeverage)
      if (market?.status !== "ACTIVE" || !snapshot || maxLeverage === null) {
        throw new Error("Market risk parameters are unavailable")
      }

      return {
        maxLeverage,
        // The current indexer source does not expose maintenance margin yet;
        // liquidation stays unavailable until that parameter is verified.
        maintenanceMarginRateBps: null,
        updatedAt: parseTimestamp(snapshot.timestamp),
      }
    },
    enabled: Boolean(marketKey),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const params = query.data ?? null
  return {
    params,
    state: getRiskState(params),
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
