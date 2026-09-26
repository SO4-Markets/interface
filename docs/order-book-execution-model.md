# Order-book execution model and lifecycle contracts

Status: prerequisite analysis for OB-002 and OB-004. An executable order-book
release remains blocked until the missing venue and settlement evidence below is
verified by the protocol owners.

## Execution model

SO4 is currently an integrated keeper venue over unified pool liquidity, not a
native price-time matching book. The client can create and cancel protocol
orders, but it must not present account orders, oracle prices, or pool balances
as resting executable depth.

| Capability | Current evidence | Conclusion / owner | Unblock evidence |
| --- | --- | --- | --- |
| Create | `ExchangeRouter.create_order` in `apps/docs/content/concepts/order-types.mdx` and the generated router client | Available; protocol/contracts | Contract test showing accepted order key and event |
| Cancel | `ExchangeRouter.cancel_order(caller, order_key)` and `ord_can` in `apps/s03-indexer/src/mappings/mappingHandlers.ts` | Available; protocol/contracts | Cancellation event and vault refund observed on testnet |
| Matching | Order execution is keeper-triggered against oracle price and pool liquidity; no bid/ask matcher or price-time queue is present | Missing for a native book; protocol/venue team | Named venue design, contract/API, and replayable match test |
| Resting liquidity | `OrderVault` escrows collateral; the pool is the counterparty, not a resting order queue | Custody exists; book depth is missing; protocol team | Source of truth for level-2 depth, sequence, and stale-data behavior |
| Partial fills | `ord_exe` records order execution, but no fill quantity/remaining quantity contract is exposed in the indexer schema | Missing/undefined; protocol/indexer team | Contract event/API with fill quantity, remaining quantity, and idempotency key |
| Custody | `OrderVault` reference documents collateral transfer and refund paths | Available for protocol orders; contracts team | Testnet proof linking order key to escrow and refund |
| Signing/submission | Wallet transaction flow and Soroban transaction hash are available in the web app | Available; web/wallet team | Distinct approval, submission, and ledger-confirmation states in UI |
| Settlement | Position changes and pool accounting settle keeper executions; there is no order-book trade settlement API | Available for pool execution, missing for matched-book settlement; protocol team | Settlement contract/API, fill authority, and reconciliation fixture |
| Indexer catch-up | `Order` stores lifecycle ledger/timestamp/transaction fields and deduplicates by key | Available for lifecycle observation; not proof of freshness | Confirmed-ledger watermark and catch-up query contract |

## Release gate

The trading UI may show protocol order status and clearly labelled pool
execution. It must not show an executable order book, resting depth, partial
fills, or “filled” after transaction confirmation without the owning teams'
evidence above. A transaction hash proves submission/ledger confirmation only;
`ord_exe` plus the resulting position/settlement evidence proves execution.

## Separate state machines

Transaction attempts and orders are intentionally separate. One order can have
multiple transaction attempts, and a confirmed transaction can still be
followed by indexer catch-up before the order state is observable.

| State | Authoritative evidence | Notes |
| --- | --- | --- |
| Transaction: `draft` | Local form state | No network claim |
| Transaction: `awaiting_signature` | Wallet request pending | Approval is not submission |
| Transaction: `submitted` | Returned transaction hash | Does not imply acceptance or execution |
| Transaction: `confirmed` | Stellar ledger inclusion | Does not imply a fill |
| Transaction: `unknown` | Timeout/network ambiguity | Reconcile by hash before retry |
| Order: `created`/`active` | `ord_crt`/`ord_upd` indexed with order key | Resting protocol request, not level-2 depth |
| Order: `frozen` | `ord_frz` | Requires explicit cancellation or protocol recovery |
| Order: `partially_filled` | Verified fill quantity event/API | Unsupported until protocol evidence exists |
| Order: `executed` | `ord_exe` plus settlement/position evidence | Terminal fill state |
| Order: `cancelled` | `ord_can` plus refund evidence | Cancellation can race execution |
| Order: `expired`/`rejected` | Explicit protocol reason/event | Do not infer from UI timeout |

Cancellation racing a fill is resolved by ledger order and the protocol's
authoritative event sequence; duplicate observations are collapsed by the
stable order key plus event/transaction hash. A late confirmation after a
client timeout reconciles the existing attempt rather than creating a new
order.
