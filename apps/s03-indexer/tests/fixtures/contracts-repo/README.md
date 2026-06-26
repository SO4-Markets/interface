# Fixture contracts repo

This directory mirrors the on-disk layout of the real contracts repo
(`../contracts` relative to this interface repo) so the indexer sync script and
manifest validation checks can run **without a live Stellar deploy**.

It is used by:

- `scripts/check-integration.sh` — local pre-PR integration check.
- `.github/workflows/integration-checks.yml` — CI integration check.
- Manual reproduction:

  ```bash
  SO4_CONTRACTS_REPO=apps/s03-indexer/tests/fixtures/contracts-repo \
    bun run --cwd apps/s03-indexer sync:contracts:local
  ```

The IDs here are real testnet contract IDs reused as deterministic fixtures —
they are **not** intended to be deployed against or signed for. Treat them as
shape-valid sample data.

## Layout

```
contracts-repo/
├── .deployed/
│   ├── local.env             # core contracts + market token triplets
│   ├── tokens-local.env      # TUSDC / TWBTC / TETH / TXLM / FAUCET
│   ├── frontend-local.env    # frontend export env
│   └── frontend-local.ts     # frontend export TypeScript (passphrase, RPC)
└── .stellar/
    └── contract-ids/
        └── local.json        # combined network passphrase + contract IDs
```

Update these fixtures whenever the contracts repo adds a new core contract or
deployment file shape — they are the canonical sample input for offline checks.
