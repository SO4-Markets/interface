/**
 * apps/web/src/lib/graphql/types.ts
 *
 * TypeScript types matching the SubQuery GraphQL schema.
 * These types mirror the entities defined in apps/s03-indexer/schema.graphql
 */

// ─────────────────────────────────────────────────────────────────────────────
// Base Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProtocolContract = {
  id: string
  key: string
  address: string
  contractType: string
  name: string | null
  network: string | null
  firstSeenLedger?: number
  firstSeenTimestamp?: Date
  transactionHash?: string
}

export type Token = {
  id: string
  contract?: ProtocolContract | null
  address: string
  symbol: string | null
  name: string | null
  decimals: number | null
  tokenType: string | null
  firstSeenLedger?: number
  firstSeenTimestamp?: Date
  transactionHash?: string
}

export type Market = {
  id: string
  key: string
  contract?: ProtocolContract
  marketToken?: Token
  indexToken?: Token
  longToken?: Token
  shortToken?: Token
  name: string | null
  status: string
  createdBy: string
  createdLedger: number
  createdTimestamp: Date
  createdTransactionHash: string
  latestConfigSnapshot?: MarketConfigSnapshot | null
}

export type MarketConfigSnapshot = {
  id: string
  market: Market
  key: string
  version: number | null
  oracle: string | null
  maxLeverage: string | null
  minCollateralUsd: string | null
  borrowingFactor: string | null
  fundingFactor: string | null
  depositFeeFactor: string | null
  withdrawalFeeFactor: string | null
  liquidationFeeUsd: string | null
  rawConfig: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidity Operations
// ─────────────────────────────────────────────────────────────────────────────

export type Deposit = {
  id: string
  key: string
  market: Market
  account: string
  receiver: string | null
  status: string
  longTokenAmount: string | null
  shortTokenAmount: string | null
  minMarketTokens: string | null
  marketTokenAmount: string | null
  executionFee: string | null
  createdLedger: number | null
  createdTimestamp: Date | null
  createdTransactionHash: string | null
  executedLedger: number | null
  executedTimestamp: Date | null
  executedTransactionHash: string | null
  cancelledLedger: number | null
  cancelledTimestamp: Date | null
  cancelledTransactionHash: string | null
  cancellationReason: string | null
}

export type Withdrawal = {
  id: string
  key: string
  market: Market
  account: string
  receiver: string | null
  status: string
  marketTokenAmount: string | null
  minLongTokenAmount: string | null
  minShortTokenAmount: string | null
  longTokenAmount: string | null
  shortTokenAmount: string | null
  executionFee: string | null
  createdLedger: number | null
  createdTimestamp: Date | null
  createdTransactionHash: string | null
  executedLedger: number | null
  executedTimestamp: Date | null
  executedTransactionHash: string | null
  cancelledLedger: number | null
  cancelledTimestamp: Date | null
  cancelledTransactionHash: string | null
  cancellationReason: string | null
}

export type PoolBalanceSnapshot = {
  id: string
  market: Market
  token: Token | null
  side: string
  poolAmount: string
  reservedAmount: string | null
  openInterest: string | null
  pnlPoolUsd: string | null
  feePoolAmount: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

export type MarketTokenTransfer = {
  id: string
  token: Token | null
  contractAddress: string
  from: string | null
  to: string | null
  account: string | null
  transferType: string
  amount: string
  ledger: number
  timestamp: Date
  transactionHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Trading Operations
// ─────────────────────────────────────────────────────────────────────────────

export type Order = {
  id: string
  key: string
  market: Market
  account: string
  receiver: string | null
  positionKey: string | null
  orderType: string
  status: string
  isLong: boolean | null
  collateralToken: Token | null
  swapPath: string | null
  sizeDeltaUsd: string | null
  collateralDeltaAmount: string | null
  triggerPrice: string | null
  acceptablePrice: string | null
  executionFee: string | null
  referralCode: string | null
  createdLedger: number | null
  createdTimestamp: Date | null
  createdTransactionHash: string | null
  updatedLedger: number | null
  updatedTimestamp: Date | null
  updatedTransactionHash: string | null
  frozenLedger: number | null
  frozenTimestamp: Date | null
  frozenTransactionHash: string | null
  executedLedger: number | null
  executedTimestamp: Date | null
  executedTransactionHash: string | null
  cancelledLedger: number | null
  cancelledTimestamp: Date | null
  cancelledTransactionHash: string | null
  cancellationReason: string | null
}

export type Position = {
  id: string
  key: string
  market: Market
  account: string
  collateralToken: Token | null
  isLong: boolean
  status: string
  sizeUsd: string | null
  collateralAmount: string | null
  averagePrice: string | null
  entryFundingRate: string | null
  reserveAmount: string | null
  realizedPnlUsd: string | null
  realizedPnlAmount: string | null
  latestOrderKey: string | null
  openedLedger: number | null
  openedTimestamp: Date | null
  openedTransactionHash: string | null
  updatedLedger: number | null
  updatedTimestamp: Date | null
  updatedTransactionHash: string | null
  closedLedger: number | null
  closedTimestamp: Date | null
  closedTransactionHash: string | null
}

export type PositionChange = {
  id: string
  key: string
  market: Market
  position: Position | null
  account: string
  order: Order | null
  changeType: string
  status: string
  isLong: boolean | null
  sizeDeltaUsd: string | null
  nextSizeUsd: string | null
  collateralDeltaAmount: string | null
  nextCollateralAmount: string | null
  executionPrice: string | null
  indexTokenPrice: string | null
  pnlUsd: string | null
  priceImpactUsd: string | null
  borrowingFeeUsd: string | null
  fundingFeeAmount: string | null
  positionFeeAmount: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

export type Liquidation = {
  id: string
  key: string
  market: Market
  position: Position | null
  account: string
  liquidator: string | null
  collateralToken: Token | null
  status: string
  isLong: boolean | null
  sizeDeltaUsd: string | null
  collateralLiquidatedAmount: string | null
  remainingCollateralAmount: string | null
  liquidationPrice: string | null
  pnlUsd: string | null
  priceImpactUsd: string | null
  liquidationFeeUsd: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

export type AdlEvent = {
  id: string
  key: string
  market: Market
  position: Position | null
  account: string
  collateralToken: Token | null
  status: string
  isLong: boolean | null
  sizeReductionUsd: string | null
  collateralReductionAmount: string | null
  executionPrice: string | null
  pnlUsd: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee Types
// ─────────────────────────────────────────────────────────────────────────────

export type FeeClaim = {
  id: string
  key: string
  market: Market | null
  token: Token | null
  account: string
  receiver: string | null
  feeType: string
  amount: string
  amountUsd: string | null
  status: string
  ledger: number
  timestamp: Date
  transactionHash: string
}

export type UiFeeAccrual = {
  id: string
  key: string
  market: Market | null
  order: Order | null
  account: string
  uiFeeReceiver: string
  token: Token | null
  amount: string
  amountUsd: string | null
  ledger: number
  timestamp: Date
  transactionHash: string
}

export type FundingFeeClaim = {
  id: string
  key: string
  market: Market | null
  position: Position | null
  account: string
  receiver: string | null
  token: Token | null
  amount: string
  amountUsd: string | null
  status: string
  ledger: number
  timestamp: Date
  transactionHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReferralCode = {
  id: string
  code: string
  owner: string
  status: string
  createdLedger: number
  createdTimestamp: Date
  createdTransactionHash: string
}

export type TraderReferral = {
  id: string
  trader: string
  referralCode: ReferralCode
  referrer: string
  status: string
  createdLedger: number
  createdTimestamp: Date
  createdTransactionHash: string
  updatedLedger: number | null
  updatedTimestamp: Date | null
  updatedTransactionHash: string | null
}

export type ReferralOwnershipTransfer = {
  id: string
  referralCode: ReferralCode
  code: string
  previousOwner: string
  newOwner: string
  ledger: number
  timestamp: Date
  transactionHash: string
}
