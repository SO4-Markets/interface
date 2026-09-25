/**
 * Slowly changing, price-independent position state.
 *
 * Oracle-derived mark/PnL presentation stays outside this hook so high
 * frequency price updates do not reorder the whole positions table.
 */

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { sortPositionRows } from "../lib/position-risk"
import { useAccountPositions } from "./useAccountPositions"
import type { PositionInfo } from "@/lib/contracts"
import type { Position as IndexedPosition } from "@/lib/graphql/types"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { syntheticsReaderClient } from "@/lib/contracts"
import { fromSorobanAmount } from "@/shared/lib/bignum"

const CHAIN_ID = activeQueryNetwork()
const USD_DECIMALS = 30
const DEFAULT_TOKEN_DECIMALS = 7

/** Fresh, price-independent numbers read straight from the contracts. */
export type FreshPositionData = {
  pnlUsd: number
  fundingFeeUsd: number
  liquidationPriceUsd: number
  sizeInUsdRaw: bigint
}

export type PositionState = {
  key: string
  account: string
  marketAddress: string
  marketName: string
  indexToken: string
  collateralToken: string
  /** Collateral token units. */
  collateralAmount: number
  /** Position size in USD (authoritative). */
  sizeUsd: number
  /** Exact on-chain size, used to derive partial deltas without float loss. */
  sizeInUsdRaw: bigint
  entryPrice: number
  /** Contract-reported PnL, before funding. */
  pnlUsd: number
  /** Accrued funding fee in USD. */
  fundingFeeUsd: number
  /** Contract-reported liquidation price. */
  liquidationPriceUsd: number
  isLong: boolean
  /** True when the fresh contract read is unavailable for this indexed row. */
  isRiskDataStale: boolean
}

export type UsePositionStateResult = {
  data: Array<PositionState>
  isLoading: boolean
  isRefreshing: boolean
  isDisabled: boolean
  refetch: () => void
}

export function freshPositionKey(
  account: string,
  market: string,
  collateralToken: string,
  isLong: boolean,
): string {
  return `${account}-${market}-${collateralToken}-${isLong}`
}

/** Fetch fresh PnL, funding, liquidation, and raw size from the contracts. */
export async function fetchFreshPositionData(
  account: string,
): Promise<Map<string, FreshPositionData>> {
  const rawPositions = await syntheticsReaderClient.getAccountPositions(account)

  const freshDataMap = new Map<string, FreshPositionData>()
  for (const positionInfo of rawPositions) {
    const position = positionInfo.position
    const key = freshPositionKey(
      position.account,
      position.market,
      position.collateralToken,
      position.isLong,
    )
    freshDataMap.set(key, {
      pnlUsd: fromSorobanAmount(positionInfo.pnlUsd, USD_DECIMALS),
      fundingFeeUsd: fromSorobanAmount(positionInfo.fundingFeeUsd, USD_DECIMALS),
      liquidationPriceUsd: fromSorobanAmount(
        positionInfo.liquidationPrice,
        USD_DECIMALS,
      ),
      sizeInUsdRaw: position.sizeInUsd,
    })
  }

  return freshDataMap
}

function parseRawAmount(
  raw: string | null | undefined,
  decimals: number,
): number {
  if (!raw) return 0
  try {
    return fromSorobanAmount(BigInt(raw), decimals)
  } catch {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : 0
  }
}

function indexedToState(
  indexed: IndexedPosition,
  fresh: FreshPositionData | undefined,
): PositionState {
  const collateralToken = indexed.collateralToken?.address ?? ""
  const collateralDecimals =
    indexed.collateralToken?.decimals ?? DEFAULT_TOKEN_DECIMALS
  const sizeUsd = parseRawAmount(indexed.sizeUsd, USD_DECIMALS)
  const collateralAmount = parseRawAmount(
    indexed.collateralAmount,
    collateralDecimals,
  )
  const entryPrice = parseRawAmount(indexed.averagePrice, USD_DECIMALS)
  const key = freshPositionKey(
    indexed.account,
    indexed.market.key,
    collateralToken,
    indexed.isLong,
  )

  return {
    key,
    account: indexed.account,
    marketAddress: indexed.market.key,
    marketName: indexed.market.name ?? indexed.market.key,
    indexToken: indexed.market.indexToken?.address ?? "",
    collateralToken,
    collateralAmount,
    sizeUsd,
    sizeInUsdRaw: fresh?.sizeInUsdRaw ?? BigInt(indexed.sizeUsd ?? "0"),
    entryPrice,
    pnlUsd: fresh?.pnlUsd ?? 0,
    fundingFeeUsd: fresh?.fundingFeeUsd ?? 0,
    liquidationPriceUsd: fresh?.liquidationPriceUsd ?? 0,
    isLong: indexed.isLong,
    isRiskDataStale: fresh === undefined,
  }
}

export function usePositionState(): UsePositionStateResult {
  const account = useWalletStore((state) => state.address)
  const indexed = useAccountPositions(account)

  const freshQuery = useQuery({
    queryKey: queryKeys.trade.positionsFresh(CHAIN_ID, account ?? ""),
    queryFn: () => fetchFreshPositionData(account!),
    enabled: Boolean(account),
    staleTime: 10_000,
  })

  const data = useMemo(() => {
    const fresh = freshQuery.data
    const rows = indexed.data
      .filter((position) => position.status.toLowerCase() !== "closed")
      .map((position) => {
        const collateralToken = position.collateralToken?.address ?? ""
        const key = freshPositionKey(
          position.account,
          position.market.key,
          collateralToken,
          position.isLong,
        )
        return indexedToState(position, fresh?.get(key))
      })
      .filter((position) => position.sizeUsd > 0)

    return sortPositionRows(rows)
  }, [freshQuery.data, indexed.data])

  return {
    data,
    isLoading: indexed.isLoading && data.length === 0,
    isRefreshing: freshQuery.isFetching || (indexed.isLoading && data.length > 0),
    isDisabled: indexed.isDisabled || !INDEXER_CONFIG.enabled,
    refetch: () => {
      void freshQuery.refetch()
    },
  }
}

/** Compile-time seam for the generated contract reader payload. */
export type ContractPositionInfo = PositionInfo
