// Static token list — replace with on-chain fetch from Stellar when contracts are live

export type Token = {
  address: string
  symbol: string
  name: string
  decimals: number
  isStable: boolean
  priceDecimals: number
  logoUrl?: string
}

export const TOKENS: Array<Token> = [
  {
    address: "XLM",
    symbol: "XLM",
    name: "Stellar Lumens",
    decimals: 7,
    isStable: false,
    priceDecimals: 4,
  },
  {
    address: "BTC",
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    isStable: false,
    priceDecimals: 2,
  },
  {
    address: "ETH",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 8,
    isStable: false,
    priceDecimals: 2,
  },
  {
    address: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 7,
    isStable: true,
    priceDecimals: 4,
  },
  {
    address: "USDT",
    symbol: "USDT",
    name: "Tether",
    decimals: 7,
    isStable: true,
    priceDecimals: 4,
  },
]

export const STABLE_TOKENS = TOKENS.filter((t) => t.isStable)
export const INDEX_TOKENS = TOKENS.filter((t) => !t.isStable)

export function getToken(address: string): Token | undefined {
  return TOKENS.find((t) => t.address === address)
}
