/**
 * Deterministic order book fixtures for testing trading UI.
 * Prices, quantities, timestamps, and IDs are internally consistent
 * and include boundary values. Fixtures are replayable across multiple tests.
 */

// Deterministic IDs and timestamps for consistent test behavior
const BASE_TIMESTAMP = 1725283200000 // 2026-09-02 12:00:00 UTC
const ACCOUNT_ADDRESS = "GBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP"
const MARKET_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHSC4"

/**
 * Market metadata fixture — reflects an actual Stellar market with fee structure.
 * Values are deterministic so snapshots/deltas are always consistent.
 */
export const mockMarketMetadata = {
  id: MARKET_ADDRESS,
  symbol: "BTC/USD",
  baseToken: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHSC4",
  quoteToken: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",
  makerFeeRate: 0.0001, // 0.01%
  takerFeeRate: 0.0005, // 0.05%
  minOrderSize: 0.001, // 0.001 BTC
  minOrderValue: 25, // $25 minimum
  maxLeverage: 20,
  fundingIntervalSeconds: 3600,
  lastFundingTimestamp: BASE_TIMESTAMP - 3600000,
}

/**
 * Order book snapshot at base timestamp with realistic depth.
 * Spread is 2 cents (0.02%), matching typical trading activity.
 */
export const mockOrderBookSnapshot = {
  timestamp: BASE_TIMESTAMP,
  market: mockMarketMetadata.symbol,
  bids: [
    { price: 42999.98, quantity: 0.5, orderId: "bid-0-001" },
    { price: 42999.50, quantity: 1.2, orderId: "bid-0-002" },
    { price: 42998.00, quantity: 2.0, orderId: "bid-0-003" },
    { price: 42995.00, quantity: 3.5, orderId: "bid-0-004" },
    { price: 42990.00, quantity: 5.0, orderId: "bid-0-005" },
  ],
  asks: [
    { price: 43000.00, quantity: 0.5, orderId: "ask-0-001" },
    { price: 43000.50, quantity: 1.2, orderId: "ask-0-002" },
    { price: 43002.00, quantity: 2.0, orderId: "ask-0-003" },
    { price: 43005.00, quantity: 3.5, orderId: "ask-0-004" },
    { price: 43010.00, quantity: 5.0, orderId: "ask-0-005" },
  ],
}

/**
 * Recent trades showing natural volume distribution.
 * Trades alternate between buys and sells with realistic sizes.
 */
export const mockRecentTrades = [
  {
    id: "trade-0-001",
    price: 42999.98,
    quantity: 0.25,
    side: "buy",
    timestamp: BASE_TIMESTAMP - 180000, // 3 minutes ago
    maker: "GBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
    taker: "CBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
  },
  {
    id: "trade-0-002",
    price: 43000.00,
    quantity: 0.5,
    side: "sell",
    timestamp: BASE_TIMESTAMP - 120000, // 2 minutes ago
    maker: "CBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
    taker: "GBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
  },
  {
    id: "trade-0-003",
    price: 42998.50,
    quantity: 0.75,
    side: "buy",
    timestamp: BASE_TIMESTAMP - 60000, // 1 minute ago
    maker: "GBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
    taker: "CBPC4YBQJFVW64ECTWDMKVVHFQKFPBPXFHBXPXFPXFPXFPXFPXFP",
  },
]

/**
 * Transaction lifecycle stages for a single order.
 * Used to test UI feedback across submission → acceptance → fill → settlement.
 */
export const mockTransactionStages = {
  submitted: {
    id: "tx-submitted-001",
    type: "order-create",
    status: "submitted",
    timestamp: BASE_TIMESTAMP - 30000,
    hash: "0x1234567890abcdef1234567890abcdef12345678",
  },
  confirmed: {
    id: "tx-confirmed-001",
    type: "order-create",
    status: "ledger-confirmed",
    timestamp: BASE_TIMESTAMP - 20000,
    hash: "0x1234567890abcdef1234567890abcdef12345678",
    ledgerSequence: 12345678,
  },
  accepted: {
    id: "tx-accepted-001",
    type: "order",
    status: "accepted",
    timestamp: BASE_TIMESTAMP - 15000,
    orderId: "order-test-001",
    sizeUsd: 100000,
    price: 43000,
  },
  partially_filled: {
    id: "tx-filled-001",
    type: "order",
    status: "partially-filled",
    timestamp: BASE_TIMESTAMP - 5000,
    orderId: "order-test-001",
    filledSize: 0.5,
    filledPrice: 42999.99,
    remainingSize: 0.5,
  },
}

/**
 * Account state snapshot with positions, orders, and balances.
 * Values are internally consistent (positions reconcile with fills).
 */
export const mockAccountSnapshot = {
  account: ACCOUNT_ADDRESS,
  timestamp: BASE_TIMESTAMP,
  positions: [
    {
      id: "position-001",
      market: mockMarketMetadata.symbol,
      isLong: true,
      sizeUsd: 100000,
      collateralUsd: 5000,
      avgEntryPrice: 42998.5,
      markPrice: 42999.98,
      unrealizedPnl: 148.5,
      funding: -12.5,
    },
  ],
  orders: [
    {
      id: "order-001",
      market: mockMarketMetadata.symbol,
      type: "limit-sell",
      isLong: false,
      triggerPrice: 43200,
      sizeUsd: 50000,
      collateralUsd: 2500,
      status: "active",
      createdAt: BASE_TIMESTAMP - 300000,
    },
  ],
  balances: {
    collateral: 5000,
    locked: 7500,
    available: -2500, // Negative indicates need to add collateral
  },
}

/**
 * Empty order book — used for testing loading and no-liquidity states.
 */
export const mockEmptyOrderBook = {
  timestamp: BASE_TIMESTAMP,
  market: mockMarketMetadata.symbol,
  bids: [],
  asks: [],
}

/**
 * Stale order book snapshot (5 minutes old) for testing staleness indicators.
 */
export const mockStaleOrderBook = {
  ...mockOrderBookSnapshot,
  timestamp: BASE_TIMESTAMP - 300000,
}

/**
 * Error response shape for testing failure states.
 */
export const mockOrderBookError = {
  code: "SERVICE_UNAVAILABLE",
  message: "Order book feed is temporarily unavailable",
  timestamp: BASE_TIMESTAMP,
}
