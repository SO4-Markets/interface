# Order book feed replay and execution conformance (OB-050)

A deterministic suite that replays feed and order event streams through the
production code and checks that every route ends at the authoritative final
state. Run it with:

```bash
bun run --cwd apps/web test -- src/features/trade/lib/orderbook/conformance
```

## What is tested, and against which versions

| Subject | Module | Last changed at |
|---|---|---|
| Book reconciliation (snapshot, delta, gap, reset) | `lib/orderbook/book-reducer.ts` | `c1c9e6c` |
| Display depth (used for the spread check) | `lib/orderbook/depth.ts` | `a4c0386` |
| Freshness and quote gating | `lib/source-freshness.ts` | this PR |
| Order lifecycle stage derivation | `lib/order-lifecycle.ts` | `2ce96b9` |
| Indexer `Order` entity the lifecycle statuses come from | `apps/s03-indexer/schema.graphql` | `652d4e6` |

Suite written against `upstream/main` at `72fcb98` (2026-09-26). The reducer
models revisions as one strictly increasing integer where a delta is valid only
directly after its predecessor; that is the schema this suite covers. There is
no deployment identifier because nothing here connects to a deployment.

## What the scenarios cover

- **Duplicates:** deltas delivered two or three times, duplicated snapshots, and
  duplicates buffered before a snapshot.
- **Disconnect and reconnect:** the book is discarded and not actionable until a
  fresh snapshot arrives; buffered deltas the snapshot already covers are dropped
  and the rest replayed in revision order; repeated disconnects start clean.
- **Missing revisions:** a hole makes the book non-actionable and reports the
  expected and received revisions; nothing past the hole is applied; a late
  arrival of the missing revision does not repair it; only a snapshot does.
- **Partial fills:** a partial fill is never presented as filled; fills are
  counted once by event id; over-fills are capped.
- **Cancellation races:** cancel-versus-fill outcomes are decided by the
  authoritative sequence, not by arrival order. Every arrival permutation of
  each race is checked, and all give the same final stage.
- **Randomized convergence:** seeded, so identical on every machine. Any
  duplicated, reordered delivery that ends in a covering snapshot converges; an
  in-order stream with replays converges without one; an unsorted burst
  buffered before the snapshot replays in revision order.

The expected book comes from an independent oracle (`feed-replay.ts`), not from
the reducer under test. Mutation checks were run against the suite: breaking the
gap check, the duplicate check, or the reset in the reducer, or making the stage
derivation call a partial fill filled, each makes it fail.

## What is mocked, and what is not verified

**Everything here is mocked.** Fixtures are hand-built in
`conformance.test.ts`. They are modelled on how a level-2 book stream behaves and
are not captured from any venue. No network is used.

**Not verified against a live upstream** (nothing in this PR claims otherwise):

- that any real venue's messages map onto the reducer's revision model;
- the real ordering guarantees of the indexer's order and fill events;
- real reconnect timing, rate limiting or snapshot latency.

**Order and fill events use a reference fold** (`order-fold.ts`, test support,
not production code) because the app does not yet consume the indexer's
order/fill events as a stream. The fold states the rules the account UI relies
on; the production part under test is `deriveOrderLifecycleStage`. When the
indexer's order/fill data is consumed directly (OB-047), the fold should be
replaced by the production reducer and these scenarios kept as its tests.

**Book revisions are not linked to orders or fills.** The issue asks for that
"where the source exposes that relationship". The indexer's `Order` entity
carries ledger numbers and timestamps, not book revisions, so there is no
relationship to test. Ordering between orders and fills is by ledger sequence.

## Extending it

Add a scenario as steps in `conformance.test.ts` and, for books, compare with
`oracleBook`. Keep randomness seeded via `mulberry32` so failures reproduce.
