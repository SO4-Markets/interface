/**
 * apps/web/src/lib/graphql/queries.ts
 *
 * Typed GraphQL query helpers for SubQuery.
 * Each query returns a typed document for use with executeGraphQLQuery.
 */

import type {
  Deposit,
  FeeClaim,
  Market,
  MarketConfigSnapshot,
  Order,
  PoolBalanceSnapshot,
  Position,
  PositionChange,
  TraderReferral,
  Withdrawal,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create typed document nodes
// ─────────────────────────────────────────────────────────────────────────────

export type TypedDocumentNode<TResult, TVariables> = {
  kind: "Document"
  loc?: { source: { body: string } }
  __apiType?: (variables: TVariables) => TResult
}

function gql<TResult, TVariables = Record<string, never>>(
  query: string,
): TypedDocumentNode<TResult, TVariables> {
  return {
    kind: "Document",
    loc: { source: { body: query } },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_ACCOUNT_POSITIONS = gql<
  { positions: { nodes: Array<Position> } },
  { account: string }
>(`
  query GetAccountPositions($account: String!) {
    positions(filter: { account: { equalTo: $account } }, orderBy: UPDATED_TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        isLong
        status
        sizeUsd
        collateralAmount
        averagePrice
        entryFundingRate
        reserveAmount
        realizedPnlUsd
        realizedPnlAmount
        openedLedger
        openedTimestamp
        updatedTimestamp
        closedTimestamp
        market {
          id
          key
          name
          indexToken { address symbol }
          longToken { address symbol }
          shortToken { address symbol }
        }
        collateralToken { address symbol decimals }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Order Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_ACCOUNT_ORDERS = gql<
  { orders: { nodes: Array<Order> } },
  { account: string }
>(`
  query GetAccountOrders($account: String!) {
    orders(filter: { account: { equalTo: $account } }, orderBy: UPDATED_TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        orderType
        status
        isLong
        sizeDeltaUsd
        collateralDeltaAmount
        triggerPrice
        acceptablePrice
        createdTimestamp
        updatedTimestamp
        frozenTimestamp
        frozenTransactionHash
        executedTimestamp
        executedTransactionHash
        cancelledTimestamp
        cancelledTransactionHash
        cancellationReason
        market {
          id
          key
          name
        }
        collateralToken { address symbol decimals }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Market and Pool Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_MARKETS = gql<{ markets: { nodes: Array<Market> } }, Record<string, never>>(`
  query GetMarkets {
    markets(orderBy: CREATED_TIMESTAMP_DESC) {
      nodes {
        id
        key
        name
        status
        createdBy
        createdLedger
        createdTimestamp
        createdTransactionHash
        marketToken { address symbol }
        indexToken { address symbol }
        longToken { address symbol }
        shortToken { address symbol }
        latestConfigSnapshot { maxLeverage timestamp ledger }
      }
    }
  }
`)

export const GET_MARKET_RISK_PARAMS = gql<
  { markets: { nodes: Array<Pick<Market, "key" | "status" | "latestConfigSnapshot">> } },
  { marketKey: string }
>(`
  query GetMarketRiskParams($marketKey: String!) {
    markets(filter: { key: { equalTo: $marketKey } }, first: 1) {
      nodes {
        key
        status
        latestConfigSnapshot {
          maxLeverage
          timestamp
          ledger
        }
      }
    }
  }
`)

export const GET_POOL_BALANCE_SNAPSHOTS = gql<
  { poolBalanceSnapshots: { nodes: Array<PoolBalanceSnapshot> } },
  { marketKey: string }
>(`
  query GetPoolBalanceSnapshots($marketKey: String!) {
    poolBalanceSnapshots(
      filter: { market: { key: { equalTo: $marketKey } } }
      orderBy: TIMESTAMP_DESC
      first: 10
    ) {
      nodes {
        id
        side
        poolAmount
        reservedAmount
        openInterest
        pnlPoolUsd
        feePoolAmount
        timestamp
        ledger
        transactionHash
        market { id key name }
        token { address symbol decimals }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Deposit and Withdrawal Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_ACCOUNT_DEPOSITS = gql<
  { deposits: { nodes: Array<Deposit> } },
  { account: string }
>(`
  query GetAccountDeposits($account: String!) {
    deposits(filter: { account: { equalTo: $account } }, orderBy: CREATED_TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        status
        longTokenAmount
        shortTokenAmount
        marketTokenAmount
        minMarketTokens
        executionFee
        createdLedger
        createdTimestamp
        createdTransactionHash
        executedLedger
        executedTimestamp
        executedTransactionHash
        cancelledLedger
        cancelledTimestamp
        cancelledTransactionHash
        cancellationReason
        market { id key name }
      }
    }
  }
`)

export const GET_ACCOUNT_WITHDRAWALS = gql<
  { withdrawals: { nodes: Array<Withdrawal> } },
  { account: string }
>(`
  query GetAccountWithdrawals($account: String!) {
    withdrawals(filter: { account: { equalTo: $account } }, orderBy: CREATED_TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        status
        marketTokenAmount
        minLongTokenAmount
        minShortTokenAmount
        longTokenAmount
        shortTokenAmount
        executionFee
        createdLedger
        createdTimestamp
        createdTransactionHash
        executedLedger
        executedTimestamp
        executedTransactionHash
        cancelledLedger
        cancelledTimestamp
        cancelledTransactionHash
        cancellationReason
        market { id key name }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Trade History Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_ACCOUNT_POSITION_CHANGES = gql<
  { positionChanges: { nodes: Array<PositionChange> } },
  { account: string }
>(`
  query GetAccountPositionChanges($account: String!) {
    positionChanges(filter: { account: { equalTo: $account } }, orderBy: TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        changeType
        status
        isLong
        sizeDeltaUsd
        nextSizeUsd
        collateralDeltaAmount
        nextCollateralAmount
        executionPrice
        indexTokenPrice
        pnlUsd
        priceImpactUsd
        borrowingFeeUsd
        fundingFeeAmount
        positionFeeAmount
        ledger
        timestamp
        transactionHash
        market {
          id
          key
          name
        }
        order {
          id
          key
          orderType
        }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Referral Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_TRADER_REFERRAL = gql<
  { traderReferrals: { nodes: Array<TraderReferral> } },
  { trader: string }
>(`
  query GetTraderReferral($trader: String!) {
    traderReferrals(filter: { trader: { equalTo: $trader } }) {
      nodes {
        id
        trader
        referrer
        status
        createdLedger
        createdTimestamp
        createdTransactionHash
        referralCode {
          code
          owner
        }
      }
    }
  }
`)

export const GET_AFFILIATE_TRADERS = gql<
  { traderReferrals: { nodes: Array<TraderReferral> } },
  { owner: string }
>(`
  query GetAffiliateTraders($owner: String!) {
    traderReferrals(filter: { referrer: { equalTo: $owner } }, orderBy: CREATED_TIMESTAMP_DESC) {
      nodes {
        id
        trader
        referrer
        createdLedger
        createdTimestamp
        createdTransactionHash
        referralCode {
          code
          owner
        }
      }
    }
  }
`)

// ─────────────────────────────────────────────────────────────────────────────
// Fee Queries
// ─────────────────────────────────────────────────────────────────────────────

export const GET_ACCOUNT_FEE_CLAIMS = gql<
  { feeClaims: { nodes: Array<FeeClaim> } },
  { account: string }
>(`
  query GetAccountFeeClaims($account: String!) {
    feeClaims(filter: { account: { equalTo: $account } }, orderBy: TIMESTAMP_DESC) {
      nodes {
        id
        key
        account
        feeType
        amount
        amountUsd
        status
        ledger
        timestamp
        transactionHash
        market { id key name }
        token { address symbol decimals }
      }
    }
  }
`)
