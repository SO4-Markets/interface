# Stellar Testnet Indexer

This Bun workspace package contains the SubQuery Stellar indexer scaffold for
the S03 app. It indexes Stellar testnet payments, account credit/debit effects,
and Soroban `transfer` events.

> **New contributor?** Start with the top-level
> [Local Full-Stack Integration Guide](../../docs/local-full-stack.md). It
> covers prerequisites, the deploy → sync → index → query → UI path end-to-end,
> troubleshooting, and the definition of done. Use the rest of this README as
> the indexer-specific reference.

## Workspace Commands

Run these commands from the repository root:

```bash
bun install
bun run indexer:codegen
bun run indexer:build
bun run indexer:dev
```

The same commands are available inside the workspace package:

```bash
bun run --cwd apps/s03-indexer codegen
bun run --cwd apps/s03-indexer build
bun run --cwd apps/s03-indexer sync:contracts:testnet
bun run --cwd apps/s03-indexer sync:contracts:local
bun run --cwd apps/s03-indexer dev
bun run --cwd apps/s03-indexer start
```

`indexer:dev` is the clean-checkout local path. It generates SubQuery artifacts,
builds the mappings, pulls the required Docker images, and starts the local
stack.

## Local Services

The Docker stack in `docker-compose.yml` starts three services:

| Service          | Image/build                                 | Port             | Purpose                                |
| ---------------- | ------------------------------------------- | ---------------- | -------------------------------------- |
| `postgres`       | local `docker/pg-Dockerfile`                | `localhost:5432` | SubQuery metadata and indexed entities |
| `subquery-node`  | `subquerynetwork/subql-node-stellar:latest` | internal `3000`  | Stellar/SubQuery indexing node         |
| `graphql-engine` | `subquerynetwork/subql-query:latest`        | `localhost:3000` | GraphQL API and playground             |

Requirements:

- Bun 1.3.x or newer, matching the root `packageManager` field.
- Docker Engine with Docker Compose v2.
- Network access for the first image pull and for public Stellar testnet
  endpoints when using the default config.

Open `http://localhost:3000` after the services become healthy to query the
GraphQL playground.

## Environment

Copy the example file when you need to customize the runtime:

```bash
cp apps/s03-indexer/.env.example apps/s03-indexer/.env
```

The default configuration targets public SDF testnet:

```dotenv
ENDPOINT=https://horizon-testnet.stellar.org
CHAIN_ID=Test SDF Network ; September 2015
SOROBAN_ENDPOINT=https://soroban-testnet.stellar.org
INDEXER_NETWORK=testnet
```

Use these defaults when indexing public testnet data or when contributors need
the same deterministic remote network.

For local standalone or `stellar/quickstart` development, switch the same
variables to the local values shown in `.env.example`:

```dotenv
ENDPOINT=http://host.docker.internal:8000
CHAIN_ID=Standalone Network ; February 2017
SOROBAN_ENDPOINT=http://host.docker.internal:8000/soroban/rpc
INDEXER_NETWORK=local
```

Use local endpoints when you are testing against a local Stellar network,
contract deployment, or fixture data. The compose file maps
`host.docker.internal` to the host gateway so the indexer container can reach a
host-run standalone node.

Endpoint and chain settings are read while SubQuery generates/builds
`project.yaml`; after changing `.env`, run `bun run indexer:codegen` and
`bun run indexer:build` before `bun run indexer:start`. `bun run indexer:dev`
does all three steps for you.

## Contract Manifests

The indexer reads SO4 contract IDs from generated JSON files in `config/`.
Refresh them after deploying or bootstrapping contracts:

```bash
bun run --cwd apps/s03-indexer sync:contracts:testnet
bun run --cwd apps/s03-indexer sync:contracts:local
```

The sync script reads the contracts repo deployment outputs:

- `.deployed/<network>.env`
- `.deployed/tokens-<network>.env`
- `.deployed/frontend-<network>.env`
- `.deployed/frontend-<network>.ts`
- `.stellar/contract-ids/<network>.json`

By default it looks for the sibling contracts repo used by the SO4 workspace
layout. Override that path when needed:

```bash
SO4_CONTRACTS_REPO=/path/to/contracts bun run --cwd apps/s03-indexer sync:contracts:testnet
```

`contracts.testnet.json` and `contracts.local.json` are separate files, so local
and testnet manifests can coexist without overwriting each other. `project.ts`
uses `INDEXER_NETWORK` to select `config/contracts.<network>.json`, or
`INDEXER_CONTRACTS_CONFIG` when you need to point at a specific manifest.

The generated config includes the network name, network passphrase, Horizon
endpoint, Soroban RPC endpoint, core protocol contracts, test token contracts,
faucet contract, and complete market token/index/long/short triplets. The sync
fails fast on malformed contract IDs and required missing values. Missing
`MARKET_TOKEN_*` values are reported as warnings because they are expected before
market bootstrap.

## Local Smoke Flow

`smoke:local` is the one documented command that proves the whole stack works
together: it drives real protocol actions through the deployed contracts and then
asserts the indexer turned those on-chain events into GraphQL entities.

```bash
bun run --cwd apps/s03-indexer build      # verify the indexer compiles
bun run --cwd apps/s03-indexer smoke:local
```

### What it does

The runner executes layered, timed steps and records each one in a JSON report:

1. **preflight** — checks `stellar` (and `make`/`docker` for fresh deploys) are on
   PATH, locates the contracts repo, and ensures local-only signing keys exist
   (generating and friendbot-funding them when needed). It never uses keys outside
   the local/test keystore.
2. **services** — confirms the Soroban RPC, Horizon, and SubQuery GraphQL endpoints
   are reachable before any transaction is sent.
3. **contracts-deploy** — validates a pre-existing local deployment discovered from
   `.deployed/local.env`, or, on a fresh network, deploys test tokens + faucet,
   deploys the protocol contracts, and bootstraps a market via the contract repo
   `make` targets.
4. **frontend-config** — runs `sync:contracts:local` so the indexer manifest matches
   the freshly deployed contract IDs.
5. **indexer-runtime** — rebuilds the indexer for the local config and starts the
   Docker stack (skippable when it is already running).
6. **contract-action** — submits fixed oracle prices, claims faucet tokens, then
   creates and executes a deposit, a `MarketIncrease` that opens a long position, a
   `MarketDecrease` that closes it, and (optionally) registers and sets a referral
   code.
7. **graphql-query** — waits for the indexer to catch up to the latest ledger and
   asserts the expected `market`, `deposit`, `order`, `position`, and `transfer`
   entity counts.

### Run modes

| Mode                    | Behavior                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `--mode auto` (default) | Reuse a complete local deployment if present, otherwise deploy + bootstrap. |
| `--mode fresh`          | Always deploy test tokens, contracts, and bootstrap a market.               |
| `--mode existing`       | Require a complete `.deployed/local.env`; fail fast if missing.             |

### Common options

All options also have `SMOKE_*` environment-variable equivalents.

```bash
bun run --cwd apps/s03-indexer smoke:local \
  --contracts-repo /path/to/contracts \   # SO4_CONTRACTS_REPO
  --source so4-local --keeper so4-local \  # local stellar CLI keys
  --long-code TWBTC --short-code TUSDC \
  --soroban-endpoint http://localhost:8000/soroban/rpc \
  --graphql-endpoint http://localhost:3000 \
  --report .smoke/report.json
```

Useful flags: `--skip-referral` (skip the optional referral step),
`--skip-indexer-restart` (assume the stack is already running with fresh config),
and `--skip-indexer-check` (contracts-only run, no GraphQL assertions).

### The report

A JSON report is written to `.smoke/report.json` (override with `--report`). It
contains the run mode, service reachability, deployment artifacts (market token,
core contract IDs, faucet), each action's ledger/transaction-hash/key data, the
GraphQL entity counts with pass/fail assertions, and — when something breaks — a
top-level `failure` block naming the broken layer (`contracts-deploy`,
`contract-action`, `indexer-runtime`, `graphql-query`, or `frontend-config`) so
you know exactly where to look.

### Rerunning cleanly

The indexer persists entities in Postgres, so rerun against a clean database:

```bash
bun run --cwd apps/s03-indexer smoke:clean        # stop stack + drop DB + clear reports
bun run --cwd apps/s03-indexer smoke:clean --keep-db
bun run --cwd apps/s03-indexer smoke:clean --reports   # only clear .smoke reports
```

## Testing Strategy

Tests live under `tests/` and use **`bun test`** (not Vitest).

| Test runner | When to use                                                                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun test`  | Pure-logic unit tests, indexer mapping handler tests, and any test that does **not** need a DOM, React components, or TypeScript type-check harness. The SubQuery Stellar indexer runs in a Node-compatible Bun runtime, so `bun:test` matches the execution environment exactly. |
| Vitest      | UI component tests (React/DOM rendering), tests that need jsdom/happy-dom, or tests that require full TypeScript type-checking via `vi.mock`-style module stubs. Vitest is used in the `web` app and `ui` package.                                                                |

**Rule of thumb:** If the test imports from `apps/s03-indexer/src/`, write it with `bun test`. If it imports React or renders DOM, write it with Vitest in the `apps/web` package.

Run indexer tests from the repo root:

```bash
bun run --cwd apps/s03-indexer test
```

This runs `subql build` followed by `bun test tests/`.

## Generated Artifacts

`project.ts`, `schema.graphql`, and the TypeScript mapping sources are the
committed source of truth. `project.yaml`, `dist/`, and `src/types/` are
generated artifacts and stay ignored so they cannot drift from the source.

Regenerate them with:

```bash
bun run indexer:codegen
bun run indexer:build
```

The repository uses the root Bun lockfile only. Do not add `package-lock.json`,
`yarn.lock`, or `pnpm-lock.yaml` files.

## Event Entity IDs

SO4 event mappings use deterministic IDs so replaying a ledger updates the same
rows instead of duplicating data. IDs are namespaced by entity and stable
protocol keys where the event exposes them:

- `market:<market-key-or-market-token>`
- `deposit:<deposit-key>`
- `withdrawal:<withdrawal-key>`
- `order:<order-key>`
- `position:<position-key>`
- `liquidation:<liquidation-key>`
- `adl:<adl-key>`
- `token-event:<subquery-event-id>`

Immutable event records that do not have a protocol key use the SubQuery event
ID inside a namespace, for example `position-change:<event-id>` and
`market-config:<event-id>`. Unknown or malformed events are logged and skipped.

## Event Payload Indices

SO4 handler contracts publish short-symbol topics with positional tuple payloads.
The indexer decodes `ScMap` payloads by field name, but `ScVec` payloads remain
positional only. The source-verified tuple offsets used by the mappings are:

- `mkt_new`: `[market_token, index_token, long_token, short_token]`
- `dep_crt`, `wth_crt`, `ord_crt`: `[key, account, market]`
- `dep_exe`, `wth_exe`, `ord_exe`, `ord_can`, `ord_upd`: `[key, account_or_receiver, ...]`
- `pos_inc`: `[position_key, account, size_delta_usd, execution_price]`
- `pos_dec`: `[position_key, account, size_delta_usd, execution_price, pnl_usd]`
- `liq_req`: `[account, market, is_long]`
- `liq_exe`: `[account, market, pnl_usd, execution_price]`
- `adl_req`: `[account, market, is_long, size_delta_usd, pnl_usd]`
- `adl_exe`: `[account, market, size_delta_usd, pnl_usd]`

## Useful Query

After the stack is running, try this query in the GraphQL playground:

```graphql
{
  query {
    transfers(first: 5, orderBy: VALUE_DESC) {
      totalCount
      nodes {
        id
        date
        ledger
        toId
        fromId
        value
      }
    }
    accounts(first: 5, orderBy: SENT_TRANSFERS_COUNT_DESC) {
      nodes {
        id
        sentTransfers(first: 5, orderBy: LEDGER_DESC) {
          totalCount
          nodes {
            id
            toId
            value
          }
        }
        firstSeenLedger
        lastSeenLedger
      }
    }
  }
}
```
