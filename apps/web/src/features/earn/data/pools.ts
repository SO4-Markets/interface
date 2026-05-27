export type GmPool = {
  id: string
  name: string
  longToken: string
  shortToken: string
  /** Annualized yield % — replace with live usePerformanceAnnualized when on-chain */
  apy: number
  tvlUsd: number
  longPct: number
  shortPct: number
}

export type GlvVault = {
  id: string
  name: string
  displayPair: string
  underlyingPools: Array<string>
  apy: number
  tvlUsd: number
}

// TODO: Replace static APY + TVL with live data from:
//   - PerformanceTracker.getAnnualizedReturn(poolAddress, "30d") on Soroban
//   - SyntheticsReader.getMarketTokenPrice × totalSupply for TVL
export const GM_POOLS: Array<GmPool> = [
  {
    id: "gm-btc-usdc",
    name: "BTC/USD",
    longToken: "BTC",
    shortToken: "USDC",
    apy: 18.24,
    tvlUsd: 12_400_000,
    longPct: 50,
    shortPct: 50,
  },
  {
    id: "gm-eth-usdc",
    name: "ETH/USD",
    longToken: "ETH",
    shortToken: "USDC",
    apy: 14.87,
    tvlUsd: 8_750_000,
    longPct: 50,
    shortPct: 50,
  },
  {
    id: "gm-xlm-usdc",
    name: "XLM/USD",
    longToken: "XLM",
    shortToken: "USDC",
    apy: 22.31,
    tvlUsd: 2_100_000,
    longPct: 48,
    shortPct: 52,
  },
]

// TODO: GLV vault APY aggregates underlying GM pool performance weighted by allocation
export const GLV_VAULTS: Array<GlvVault> = [
  {
    id: "glv-btc-usdc",
    name: "GLV",
    displayPair: "BTC-USDC",
    underlyingPools: ["gm-btc-usdc", "gm-eth-usdc"],
    apy: 10.17,
    tvlUsd: 4_250_000,
  },
  {
    id: "glv-xlm-usdc",
    name: "GLV",
    displayPair: "XLM-USDC",
    underlyingPools: ["gm-xlm-usdc"],
    apy: 8.43,
    tvlUsd: 1_800_000,
  },
]
