# Long-Session Cache Retention & State Duplication Specification (OB-109)

## 1. Overview & Long-Session Scenario

During extended trading sessions, users frequently:
1. Switch between multiple markets (e.g., XLM/USD, BTC/USD, ETH/USD, etc.).
2. Switch accounts or connect/disconnect wallets.
3. Open and close various trading tabs (Order Book, Recent Trades, Chart, Positions, Orders, Trade History).

Without bounded cache retention, each market and account switch accumulates inactive TanStack Query entities indefinitely in memory, leading to unbounded entity growth, high memory consumption, and stale server state lingering across switches.

### Bounded Cache Policy
All queries are categorized into explicit data classes with distinct freshness (`staleTime`) and retention (`gcTime`) limits:
- **`MARKET_DATA`**: `staleTime: 30s`, `gcTime: 5m` (markets, fee configuration)
- **`REALTIME_TAPE`**: `staleTime: 2s`, `gcTime: 1m` (depth levels, recent trades)
- **`ACCOUNT_FINANCIAL`**: `staleTime: 5s`, `gcTime: 2m` (positions, orders, token balances)
- **`HISTORY`**: `staleTime: 30s`, `gcTime: 3m` (candles, past trade history)

In addition, `boundQueryCache(queryClient, 50)` actively monitors the query cache. When inactive queries exceed 50 entities across repeated market and account switches, the oldest inactive entries are pruned automatically, guaranteeing strictly bounded entity growth.

---

## 2. Preventing Server-State Duplication & Local Mirrors

Local state is strictly reserved for user drafts and preferences:
- **Drafts & Preferences**: Input amounts, selected leverage, and UI layout preferences are kept in memory/local storage.
- **Server Data**: Balances, positions, executed orders, and market depths are NEVER mirrored in local storage as authoritative truth.
- **No Stale Mirror Winning**:
  - Fresh TanStack Query results always take precedence.
  - When switching markets or accounts, drafts are revalidated or cleared, and fresh queries immediately fetch server state.
  - No local state can override or mask fresh query data.

---

## 3. Retained Persistence Invariants

Any retained state in browser storage adheres to three rules:
1. **Versioned**: Stores include explicit schema versions (`version: 1`, `version: 2`) and migrations.
2. **Scoped**: Scoped by network and account address (e.g., `so4:order-events:cursor:${account}`).
3. **Freshness-Checked**:
   - `pendingTransactionXdr` in wallet storage has an explicit timestamp. If older than 15 minutes (`MAX_PENDING_TX_AGE_MS = 15 * 60 * 1000`), it is discarded on rehydration rather than blindly hydrated as current truth.
   - Account balances and live position data are strictly excluded from persistent storage.
