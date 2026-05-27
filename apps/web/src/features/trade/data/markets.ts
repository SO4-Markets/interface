// Market definitions — each market is a pool with an index token, long token, and short token
// TODO: Fetch dynamically from Stellar Soroban contract (Reader contract equivalent)

export type Market = {
  address: string
  name: string
  indexTokenAddress: string   // the asset being priced (e.g. BTC)
  longTokenAddress: string    // collateral for longs (e.g. BTC)
  shortTokenAddress: string   // collateral for shorts (e.g. USDC)
  // TODO: add on-chain fields: openInterestLong, openInterestShort, poolAmount, etc.
}

export const MARKETS: Array<Market> = [
  {
    address: "BTC-BTC-USDC",
    name: "BTC/USD",
    indexTokenAddress: "BTC",
    longTokenAddress: "BTC",
    shortTokenAddress: "USDC",
  },
  {
    address: "ETH-ETH-USDC",
    name: "ETH/USD",
    indexTokenAddress: "ETH",
    longTokenAddress: "ETH",
    shortTokenAddress: "USDC",
  },
  {
    address: "XLM-XLM-USDC",
    name: "XLM/USD",
    indexTokenAddress: "XLM",
    longTokenAddress: "XLM",
    shortTokenAddress: "USDC",
  },
]

export function getMarket(address: string): Market | undefined {
  return MARKETS.find((m) => m.address === address)
}

export function getMarketsForIndexToken(indexTokenAddress: string): Array<Market> {
  return MARKETS.filter((m) => m.indexTokenAddress === indexTokenAddress)
}
