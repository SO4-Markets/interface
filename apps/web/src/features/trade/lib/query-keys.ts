// Centralized TanStack Query key factory — keeps cache invalidation consistent

export const queryKeys = {
  // Token prices from oracle keeper (or Stellar oracle)
  tokenPrices: (chainId: string) => ["tokenPrices", chainId] as const,

  // 24h OHLC candle for price delta display
  priceDelta24h: (symbol: string) => ["priceDelta24h", symbol] as const,

  // OHLCV candles for TradingView chart
  oracleCandles: (symbol: string, period: string) =>
    ["oracleCandles", symbol, period] as const,

  // On-chain market state: pool amounts, OI, rates
  marketsInfo: (chainId: string) => ["marketsInfo", chainId] as const,

  // User open positions
  positions: (chainId: string, account: string) =>
    ["positions", chainId, account] as const,

  // User pending orders
  orders: (chainId: string, account: string) =>
    ["orders", chainId, account] as const,

  // Fee parameters from DataStore
  feeConfig: (chainId: string, marketAddress: string) =>
    ["feeConfig", chainId, marketAddress] as const,

  // Trade history
  tradeHistory: (chainId: string, account: string, page: number) =>
    ["tradeHistory", chainId, account, page] as const,
}
