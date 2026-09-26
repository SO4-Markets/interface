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

export type PagedFeeClaimsVariables = {
  account: string
  first: number
  offset: number
  feeType?: string
}

const FEE_CLAIM_FIELDS = `
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
`

export function getAccountFeeClaimsPagedDocument(
  feeType?: string | null,
) {
  const hasFeeType = typeof feeType === "string" && feeType.length > 0
  const variables = hasFeeType
    ? "$account: String!, $feeType: String!, $first: Int!, $offset: Int!"
    : "$account: String!, $first: Int!, $offset: Int!"
  const filter = hasFeeType
    ? "account: { equalTo: $account }, feeType: { equalTo: $feeType }"
    : "account: { equalTo: $account }"

  return gql<
    { feeClaims: { nodes: Array<FeeClaim> } },
    PagedFeeClaimsVariables
  >(`
    query GetAccountFeeClaimsPaged(${variables}) {
      feeClaims(
        filter: { ${filter} }
        orderBy: [TIMESTAMP_DESC, ID_DESC]
        first: $first
        offset: $offset
      ) {
        nodes {${FEE_CLAIM_FIELDS}
        }
      }
    }
  `)
}

// ─────────────────────────────────────────────────────────────────────────────
// Paginated history queries (OB-082, OB-087)
//
// SubQuery filters treat a `null` comparison value as "equal to null", which
// matches nothing (these columns are non-nullable). A single document with an
// always-present optional filter would therefore return zero rows whenever the
// filter is unused. The documents below are assembled from whitelisted clause
// fragments so a clause — and its variable declaration — only exists when the
// filter is actually applied. GraphQL requires every declared variable to be
// used, so the two must be built together.
// ─────────────────────────────────────────────────────────────────────────────

type HistoryFilterOptions = {
  /** Market contract address; `null` means every market. */
  marketKey: string | null
}

const ORDER_HISTORY_FIELDS = `
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
        createdLedger
        createdTimestamp
        createdTransactionHash
        updatedLedger
        updatedTimestamp
        updatedTransactionHash
        frozenLedger
        frozenTimestamp
        frozenTransactionHash
        executedLedger
        executedTimestamp
        executedTransactionHash
        cancelledLedger
        cancelledTimestamp
        cancelledTransactionHash
        cancellationReason
        market { id key name }
        collateralToken { address symbol decimals }`

const POSITION_CHANGE_HISTORY_FIELDS = `
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
        market { id key name }
        order { id key orderType }`

function buildPagedQueryParts(options: HistoryFilterOptions): {
  filter: string
  variables: string
} {
  if (options.marketKey) {
    return {
      filter:
        "account: { equalTo: $account }, market: { key: { equalTo: $marketKey } }",
      variables: "$account: String!, $marketKey: String!, $first: Int!, $offset: Int!",
    }
  }
  return {
    filter: "account: { equalTo: $account }",
    variables: "$account: String!, $first: Int!, $offset: Int!",
  }
}

export type PagedHistoryVariables = {
  account: string
  first: number
  offset: number
  marketKey?: string
}

export type PagedOrderHistoryResult = { orders: { nodes: Array<Order> } }
export type PagedFillHistoryResult = {
  positionChanges: { nodes: Array<PositionChange> }
}

/**
 * Order lifecycle records, newest first, with a `key` tiebreaker so offset
 * pagination is deterministic for rows sharing a timestamp.
 */
export function getAccountOrdersPagedDocument(options: HistoryFilterOptions) {
  const { filter, variables } = buildPagedQueryParts(options)
  return gql<PagedOrderHistoryResult, PagedHistoryVariables>(`
  query GetAccountOrdersPaged(${variables}) {
    orders(
      filter: { ${filter} }
      orderBy: [UPDATED_TIMESTAMP_DESC, KEY_DESC]
      first: $first
      offset: $offset
    ) {
      nodes {${ORDER_HISTORY_FIELDS}
      }
    }
  }
`)
}

/** Executed fills (position changes), newest first, same determinism rules. */
export function getAccountPositionChangesPagedDocument(
  options: HistoryFilterOptions,
) {
  const { filter, variables } = buildPagedQueryParts(options)
  return gql<PagedFillHistoryResult, PagedHistoryVariables>(`
  query GetAccountPositionChangesPaged(${variables}) {
    positionChanges(
      filter: { ${filter} }
      orderBy: [TIMESTAMP_DESC, ID_DESC]
      first: $first
      offset: $offset
    ) {
      nodes {${POSITION_CHANGE_HISTORY_FIELDS}
      }
    }
  }
`)
}
