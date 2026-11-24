import { POOL_MARKETS } from "@/features/pools/data/markets"

export type Market = {
  isDisabled?: boolean
  address: string
  name: string
  indexTokenAddress: string   // the asset being priced (e.g. BTC)
  longTokenAddress: string    // collateral for longs (e.g. BTC)
  shortTokenAddress: string   // collateral for shorts (e.g. USDC)
  // TODO: add on-chain fields: openInterestLong, openInterestShort, poolAmount, etc.
}

export const MARKETS: Array<Market> = POOL_MARKETS.map((market) => ({
  address: market.marketToken,
  name: market.displayName,
  indexTokenAddress: market.indexToken,
  longTokenAddress: market.longToken,
  shortTokenAddress: market.shortToken,
}))

export function getMarket(address: string): Market | undefined {
  return MARKETS.find((m) => m.address === address)
}

export function getMarketsForIndexToken(indexTokenAddress: string): Array<Market> {
  return MARKETS.filter((m) => m.indexTokenAddress === indexTokenAddress)
}
