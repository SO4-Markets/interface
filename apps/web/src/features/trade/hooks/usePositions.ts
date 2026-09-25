import { useQuery } from "@tanstack/react-query"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { MARKETS } from "../data/markets"
import { useTokenPrices } from "./useTokenPrices"
import type { PositionInfo } from "@/lib/contracts"
import { syntheticsReaderClient } from "@/lib/contracts"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { fromSorobanAmount } from "@/shared/lib/bignum"

export type Position = {
  key: string
  account: string
  marketAddress: string
  marketName: string
  indexToken: string
  collateralToken: string
  collateralAmount: number
  collateralUsd: number
  sizeUsd: number
  sizeInUsdRaw: bigint
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  leverage: number
  pnl: number
  pnlPercent: number
  isLong: boolean
  pnlAfterFees: number
  fundingFeeUsd: number
}

const CHAIN_ID = activeQueryNetwork()
const USD_DECIMALS = 30
const TOKEN_DECIMALS = 7

async function fetchPositions(
  account: string,
  getMidPrice: (addressOrSymbol: string) => number,
): Promise<Array<Position>> {
  const rawPositions = await syntheticsReaderClient.getAccountPositions(account)

  return rawPositions
    .filter((p: PositionInfo) => p.position.sizeInUsd > 0n)
    .map((p: PositionInfo): Position => {
      const props = p.position
      const market = MARKETS.find((m) => m.address === props.market)

      const collateralAmount = fromSorobanAmount(props.collateralAmount, TOKEN_DECIMALS)
      const sizeUsd          = fromSorobanAmount(props.sizeInUsd,        USD_DECIMALS)

      // entry price: size_usd / size_in_tokens (both on same token decimal scale)
      const sizeInTokens = fromSorobanAmount(props.sizeInTokens, TOKEN_DECIMALS)
      const entryPrice   = sizeInTokens > 0 ? sizeUsd / sizeInTokens : 0

      const pnlUsd           = fromSorobanAmount(p.pnlUsd,           USD_DECIMALS)
      const fundingFeeUsd    = fromSorobanAmount(p.fundingFeeUsd,     USD_DECIMALS)
      const liquidationPrice = fromSorobanAmount(p.liquidationPrice,  USD_DECIMALS)

      // Collateral USD: multiply token amount by current market price.
      // getMidPrice falls back to 0 for unknown tokens → collateralUsd = 0.
      const collateralPrice = getMidPrice(props.collateralToken)
      const collateralUsd   = collateralPrice > 0
        ? collateralAmount * collateralPrice
        : (sizeUsd > 0 && entryPrice > 0 ? sizeUsd * 0.01 : 0) // 100x fallback estimate

      const leverage = collateralUsd > 0 ? Math.round(sizeUsd / collateralUsd) : 0

      const pnlAfterFees = pnlUsd - fundingFeeUsd
      const pnlPercent   = collateralUsd > 0 ? (pnlAfterFees / collateralUsd) * 100 : 0

      // Mark price: use current oracle price for the index token.
      // Falls back to entry price if oracle data isn't loaded yet.
      const indexTokenAddress = market?.indexTokenAddress ?? ""
      const oracleMarkPrice = getMidPrice(indexTokenAddress)
      const markPrice = oracleMarkPrice > 0 ? oracleMarkPrice : entryPrice

      return {
        key: `${props.account}-${props.market}-${props.collateralToken}-${props.isLong}`,
        account: props.account,
        marketAddress: props.market,
        marketName: market?.name ?? props.market,
        indexToken: indexTokenAddress,
        collateralToken: props.collateralToken,
        collateralAmount,
        collateralUsd,
        sizeUsd,
        sizeInUsdRaw: props.sizeInUsd,
        entryPrice,
        markPrice,
        liquidationPrice,
        leverage,
        pnl: pnlUsd,
        pnlPercent,
        isLong: props.isLong,
        pnlAfterFees,
        fundingFeeUsd,
      }
    })
}

export function usePositions() {
  const account = useWalletStore((state) => state.address)
  const { getMidPrice } = useTokenPrices()

  return useQuery<Array<Position>>({
    queryKey: queryKeys.trade.positions(CHAIN_ID, account ?? ""),
    queryFn: () => fetchPositions(account!, getMidPrice),
    enabled: !!account,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
