import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../lib/query-keys"
import { MARKETS } from "../data/markets"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export type Position = {
  key: string                   // unique: account + market + collateral + isLong
  account: string
  marketAddress: string
  marketName: string            // e.g. "BTC/USD"
  indexToken: string
  collateralToken: string
  collateralAmount: number      // in token units
  collateralUsd: number
  sizeUsd: number
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  leverage: number
  pnl: number                   // unrealized PnL in USD
  pnlPercent: number
  isLong: boolean
  pnlAfterFees: number
  fundingFeeDebt: number
}

async function fetchPositions(account: string): Promise<Array<Position>> {
  if (!account) return []

  // TODO: replace with SyntheticsReader.getPositionInfo market query once market addresses are live.
  const positions = await Promise.all(
    MARKETS.map(async (market, index) => {
      const isLong = index % 2 === 0
      const entryPrice = market.indexTokenAddress === "BTC" ? 66_000 : market.indexTokenAddress === "ETH" ? 3_600 : 0.12
      const markPrice = entryPrice * (isLong ? 1.018 : 0.985)
      const sizeUsd = index === 0 ? 10_000 : index === 1 ? 2_500 : 0
      if (sizeUsd <= 0) return null

      const pnl = ((markPrice - entryPrice) / entryPrice) * sizeUsd * (isLong ? 1 : -1)
      const fundingFeeDebt = sizeUsd * 0.0008
      const pnlAfterFees = pnl - fundingFeeDebt

      return {
        key: `${account}-${market.address}-${isLong ? "long" : "short"}`,
        account,
        marketAddress: market.address,
        marketName: market.name,
        indexToken: market.indexTokenAddress,
        collateralToken: market.shortTokenAddress,
        collateralAmount: sizeUsd / 10,
        collateralUsd: sizeUsd / 10,
        sizeUsd,
        entryPrice,
        markPrice,
        liquidationPrice: isLong ? entryPrice * 0.94 : entryPrice * 1.09,
        leverage: 10,
        pnl,
        pnlPercent: (pnl / sizeUsd) * 100,
        isLong,
        pnlAfterFees,
        fundingFeeDebt,
      } satisfies Position
    }),
  )

  return positions.filter((position): position is Position => position !== null)
}

export function usePositions() {
  const account = useWalletStore((state) => state.address)
  return useQuery<Array<Position>>({
    queryKey: queryKeys.positions("stellar-mainnet", account ?? ""),
    queryFn: () => fetchPositions(account!),
    enabled: !!account,
    staleTime: 10_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}
