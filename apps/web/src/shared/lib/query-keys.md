# Canonical query-key migration

The web app has one query-key hierarchy: `shared/lib/query-keys.ts`.
The former trade and indexer registries are compatibility re-exports only.

Every canonical key begins with:

```
["so4", <network>, <venue>, <source>, ...]
```

This makes network, venue, and source identity explicit before entity-specific
segments. RPC and indexer representations of similar data intentionally remain
separate because they have different consistency and catch-up semantics.

| Previous producer/key | Canonical family | Notes |
| --- | --- | --- |
| trade `["markets"]` | `queryKeys.trade.markets(network)` | RPC/on-chain market configuration |
| trade `["marketsInfo", chain]` | `queryKeys.trade.marketsInfo(network)` | RPC live market state |
| trade `["positions", chain, account]` | `queryKeys.trade.positions(network, account)` | RPC account positions |
| trade `["positionsFresh", chain, account]` | `queryKeys.trade.positionsFresh(network, account)` | price-independent contract state |
| trade `["orders", chain, account]` | `queryKeys.trade.orders(network, account)` | RPC pending orders |
| trade token balances / wallet raw balance keys | `queryKeys.wallet.tokenBalances(account, network)` | single wallet-balance producer family |
| trade candles/prices/funding/fees/OI | `queryKeys.trade.*` | network is part of every identity |
| indexer positions/orders/history/fees | `indexerQueryKeys.*` | canonical source is `indexer`, not RPC |
| indexer deposits/withdrawals | `indexerQueryKeys.deposits/withdrawals` | account + network isolated |
| pools raw arrays | `queryKeys.pools.*` | account is explicit where private |
| earn raw arrays | `queryKeys.earn.*` | network-scoped |
| faucet | `queryKeys.faucet.data` | network + account-scoped |
| referrals raw arrays | `queryKeys.referrals.*` | explicit account/code/filter segments |
| landing prefetch raw arrays | `queryKeys.landing.*` | network + market/account-scoped |

## Prefix rules

Prefix helpers such as `orders.historyAll(account)`,
`tradeHistory.pagesAll(account)`, `referrals.traderStatsAll()`, and
`referrals.distributionsAll()` are intentional invalidation boundaries.
They invalidate every filter/page variant inside that family without touching
unrelated accounts, markets, networks, or sources.

Optional filter values are normalized to explicit `null` segments. An absent
filter therefore cannot accidentally collide with a different concrete value.

## Cancellation contract

Fetch-based producers consume the `AbortSignal` supplied by TanStack Query.
The GraphQL adapter forwards that signal to `fetch`; Horizon balance reads do
the same. This lets TanStack stop supported network work when a query becomes
obsolete.

Soroban SDK calls that do not expose an abort signal are guarded by canonical
network/account keys. Their late results can only resolve into the old context
key; account/network lifecycle cleanup cancels and removes private old-context
queries before they can become visible again. Cancellation is not reported as
a transaction failure and does not imply an authoritative mutation failed.
