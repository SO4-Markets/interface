import { NETWORK } from "@/app/config/network"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export type QuerySource = "rpc" | "indexer"
export type QueryVenue = "perps" | "wallet" | "earn" | "pools" | "faucet" | "referrals" | "landing"

export function normalizeQueryNetwork(network: string | null | undefined): string {
  const value = (network ?? NETWORK.name).trim().toLowerCase()
  if (value === "testnet" || value === "stellar-testnet" || value.includes("test sdf network")) {
    return "testnet"
  }
  if (
    value === "mainnet" ||
    value === "stellar-mainnet" ||
    value === "public" ||
    value.includes("public global stellar network")
  ) {
    return "mainnet"
  }
  return value || NETWORK.name
}

export function activeQueryNetwork(): string {
  return normalizeQueryNetwork(NETWORK.name)
}

function root(
  network: string | null | undefined,
  venue: QueryVenue,
  source: QuerySource,
) {
  return ["so4", normalizeQueryNetwork(network), venue, source] as const
}

function nullable(value: string | null | undefined): string | null {
  return value ?? null
}

const trade = {
  all: (network: string = activeQueryNetwork()) =>
    [...root(network, "perps", "rpc"), "trade"] as const,
  markets: (network: string = activeQueryNetwork()) =>
    [...trade.all(network), "markets"] as const,
  marketsInfo: (network: string = activeQueryNetwork()) =>
    [...trade.all(network), "markets-info"] as const,
  positions: (network: string, account: string) =>
    [...trade.all(network), "positions", account] as const,
  positionsFresh: (network: string, account: string) =>
    [...trade.all(network), "positions-fresh", account] as const,
  orders: (network: string, account: string) =>
    [...trade.all(network), "orders", account] as const,
  fundingRate: (network: string, marketAddress?: string) =>
    [...trade.all(network), "funding-rate", nullable(marketAddress)] as const,
  tokenPrices: (network: string = activeQueryNetwork()) =>
    [...trade.all(network), "token-prices"] as const,
  priceDelta24h: (symbol: string, network: string = activeQueryNetwork()) =>
    [...trade.all(network), "price-delta-24h", symbol] as const,
  oracleCandles: (
    symbol: string,
    period: string,
    network: string = activeQueryNetwork(),
  ) => [...trade.all(network), "oracle-candles", symbol, period] as const,
  feeConfig: (network: string, marketAddress: string) =>
    [...trade.all(network), "fee-config", marketAddress] as const,
  tradeHistory: (network: string, account: string, page: number) =>
    [...trade.all(network), "history", account, page] as const,
  tokenBalances: (network: string, account: string) =>
    [...trade.all(network), "token-balances", account] as const,
  openInterest: (marketAddress: string, network: string = activeQueryNetwork()) =>
    [...trade.all(network), "open-interest", marketAddress] as const,
  circuitBreaker: (symbol: string, network: string = activeQueryNetwork()) =>
    [...trade.all(network), "circuit-breaker", symbol] as const,
  tokenList: (network: string = activeQueryNetwork()) =>
    [...trade.all(network), "token-list"] as const,
}

const wallet = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "wallet", "rpc"),
  balance: (addr: string, network: string = activeQueryNetwork()) =>
    [...wallet.all(network), "balance", addr] as const,
  tokenBalances: (addr: string, network: string = activeQueryNetwork()) =>
    [...wallet.all(network), "token-balances", addr] as const,
}

const earn = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "earn", "rpc"),
  stakingInfo: (addr: string, network: string = activeQueryNetwork()) =>
    [...earn.all(network), "staking", addr] as const,
  poolData: (pool: string, network: string = activeQueryNetwork()) =>
    [...earn.all(network), "pool", pool] as const,
  marketPoolAmounts: (marketAddress: string, network: string = activeQueryNetwork()) =>
    [...earn.all(network), "market-pool-amounts", marketAddress] as const,
  gmPoolData: (
    pool: string,
    addr: string | null,
    network: string = activeQueryNetwork(),
  ) => [...earn.all(network), "gm-pool", pool, addr] as const,
  glvVaultData: (
    vault: string,
    addr: string | null,
    network: string = activeQueryNetwork(),
  ) => [...earn.all(network), "glv-vault", vault, addr] as const,
  rewardsAccrued: (addr: string, network: string = activeQueryNetwork()) =>
    [...earn.all(network), "rewards-accrued", addr] as const,
  vestingSchedule: (addr: string, network: string = activeQueryNetwork()) =>
    [...earn.all(network), "vesting-schedule", addr] as const,
  gmPositions: (network: string = activeQueryNetwork()) =>
    [...earn.all(network), "gm-positions"] as const,
  glvPositions: (network: string = activeQueryNetwork()) =>
    [...earn.all(network), "glv-positions"] as const,
}

const faucet = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "faucet", "rpc"),
  data: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...faucet.all(network), "data", addr] as const,
}

const pools = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "pools", "rpc"),
  list: (network: string = activeQueryNetwork()) =>
    [...pools.all(network), "list"] as const,
  row: (
    marketToken: string,
    addr: string | null,
    network: string = activeQueryNetwork(),
  ) => [...pools.all(network), "row", marketToken, addr] as const,
  userBalance: (
    marketToken: string,
    addr: string | null,
    network: string = activeQueryNetwork(),
  ) => [...pools.all(network), "user-balance", marketToken, addr] as const,
  depositBalances: (
    marketToken: string,
    addr: string,
    network: string = activeQueryNetwork(),
  ) => [...pools.all(network), "deposit-balances", marketToken, addr] as const,
}

const referrals = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "referrals", "rpc"),
  code: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "code", addr] as const,
  statsAll: (network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "stats"] as const,
  stats: (
    code: string | null,
    period?: string,
    network: string = activeQueryNetwork(),
  ) => [...referrals.statsAll(network), code, nullable(period)] as const,
  tier: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "tier", addr] as const,
  traderStatsAll: (network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "trader-stats"] as const,
  traderStats: (
    addr: string | null,
    period?: string,
    network: string = activeQueryNetwork(),
  ) => [...referrals.traderStatsAll(network), addr, nullable(period)] as const,
  affiliateStats: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "affiliate-stats", addr] as const,
  affiliateReferrals: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "affiliate-referrals", addr] as const,
  distributionsAll: (network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "distributions"] as const,
  distributions: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.distributionsAll(network), addr] as const,
  traderCode: (addr: string | null, network: string = activeQueryNetwork()) =>
    [...referrals.all(network), "trader-code", addr] as const,
}

const landing = {
  all: (network: string = activeQueryNetwork()) =>
    root(network, "landing", "rpc"),
  stats: (network: string = activeQueryNetwork()) =>
    [...landing.all(network), "stats"] as const,
  market: (marketId: string, network: string = activeQueryNetwork()) =>
    [...landing.all(network), "market", marketId] as const,
  orderBook: (marketId: string, network: string = activeQueryNetwork()) =>
    [...landing.all(network), "order-book", marketId] as const,
  trades: (marketId: string, network: string = activeQueryNetwork()) =>
    [...landing.all(network), "trades", marketId] as const,
  account: (account: string | null, network: string = activeQueryNetwork()) =>
    [...landing.all(network), "account", account] as const,
  positions: (account: string | null, network: string = activeQueryNetwork()) =>
    [...landing.all(network), "positions", account] as const,
}

const indexerNetwork = () => normalizeQueryNetwork(INDEXER_CONFIG.network)
const indexerRoot = (network: string = indexerNetwork()) =>
  root(network, "perps", "indexer")

export const indexerQueryKeys = {
  all: (network: string = indexerNetwork()) => indexerRoot(network),
  positions: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "positions"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "positions", account] as const,
  },
  orders: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "orders"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "orders", account] as const,
    historyAll: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "orders", "history", account] as const,
    history: (
      account: string,
      filters: { marketKey?: string | null; stage?: string | null; range?: string | null },
      network: string = indexerNetwork(),
    ) =>
      [
        ...indexerQueryKeys.orders.historyAll(account, network),
        nullable(filters.marketKey),
        nullable(filters.stage),
        nullable(filters.range),
      ] as const,
  },
  markets: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "markets"] as const,
    byKey: (key: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "markets", key] as const,
  },
  pools: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "pools"] as const,
    snapshots: (marketKey: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "pools", "snapshots", marketKey] as const,
  },
  deposits: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "deposits"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "deposits", account] as const,
  },
  withdrawals: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "withdrawals"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "withdrawals", account] as const,
  },
  tradeHistory: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "trade-history"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "trade-history", account] as const,
    pagesAll: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "trade-history", "pages", account] as const,
    pages: (
      account: string,
      filters: { marketKey?: string | null; side?: string | null; range?: string | null },
      network: string = indexerNetwork(),
    ) =>
      [
        ...indexerQueryKeys.tradeHistory.pagesAll(account, network),
        nullable(filters.marketKey),
        nullable(filters.side),
        nullable(filters.range),
      ] as const,
  },
  referrals: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "referrals"] as const,
    traderReferral: (trader: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "referrals", "trader", trader] as const,
    affiliateTraders: (owner: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "referrals", "affiliate", owner] as const,
  },
  fees: {
    all: (network: string = indexerNetwork()) =>
      [...indexerRoot(network), "fees"] as const,
    byAccount: (account: string, network: string = indexerNetwork()) =>
      [...indexerRoot(network), "fees", account] as const,
  },
}

export const queryKeys = {
  root,
  wallet,
  trade,
  earn,
  faucet,
  pools,
  referrals,
  landing,
  indexer: indexerQueryKeys,

  // Compatibility aliases used by existing trade hooks. They all resolve to
  // the same canonical families above; no separate registry exists.
  markets: trade.markets,
  marketsInfo: trade.marketsInfo,
  positions: trade.positions,
  positionsFresh: trade.positionsFresh,
  orders: trade.orders,
  fundingRate: trade.fundingRate,
  tokenPrices: trade.tokenPrices,
  priceDelta24h: trade.priceDelta24h,
  oracleCandles: trade.oracleCandles,
  feeConfig: trade.feeConfig,
  tradeHistory: trade.tradeHistory,
  tokenBalances: trade.tokenBalances,
  openInterest: trade.openInterest,
  circuitBreaker: trade.circuitBreaker,
}
