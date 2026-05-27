import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../lib/query-keys"

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
  // TODO: Add when contracts are live:
  //   fundingFeeDebt, borrowingFeeDebt, closingFeeUsd
}

// TODO: Replace with real Soroban RPC call:
//   const reader = new SyntheticsReaderContract(READER_ADDRESS)
//   return reader.getPositions(account, markets)
async function fetchPositions(account: string): Promise<Array<Position>> {
  // Dummy: returns a couple of fake open positions so the UI has something to render
  if (!account) return []

  return [
    {
      key: `${account}-BTC-USDC-long`,
      account,
      marketAddress: "BTC-BTC-USDC",
      marketName: "BTC/USD",
      indexToken: "BTC",
      collateralToken: "USDC",
      collateralAmount: 1000,
      collateralUsd: 1000,
      sizeUsd: 10_000,
      entryPrice: 66_000,
      markPrice: 67_800,
      liquidationPrice: 62_000,
      leverage: 10,
      pnl: 272.7,
      pnlPercent: 2.73,
      isLong: true,
    },
    {
      key: `${account}-ETH-USDC-short`,
      account,
      marketAddress: "ETH-ETH-USDC",
      marketName: "ETH/USD",
      indexToken: "ETH",
      collateralToken: "USDC",
      collateralAmount: 500,
      collateralUsd: 500,
      sizeUsd: 2_500,
      entryPrice: 3_600,
      markPrice: 3_520,
      liquidationPrice: 3_950,
      leverage: 5,
      pnl: 55.6,
      pnlPercent: 2.22,
      isLong: false,
    },
  ]
}

// TODO: Pass real account address from wallet context (Freighter / Albedo / etc.)
const DUMMY_ACCOUNT = "GDUMMY...STELLAR"

export function usePositions(account = DUMMY_ACCOUNT) {
  return useQuery<Array<Position>>({
    queryKey: queryKeys.positions("stellar-mainnet", account),
    queryFn: () => fetchPositions(account),
    enabled: !!account,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
