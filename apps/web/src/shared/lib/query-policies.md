# Query data-class policy

TanStack Query consumers should select a shared policy from
`query-policies.ts`. Freshness and retention are separate decisions:
`staleTime` controls revalidation eligibility, while `gcTime` controls how
long an unused result may remain cached.

| Data class | Fresh for | Retained for | Retry | Focus | Reconnect | Polling |
| --- | ---: | ---: | ---: | --- | --- | --- |
| metadata | 5 min | 30 min | 2 | no | yes | none |
| prices/depth | 2 s | 1 min | 1 | yes | yes | 5 s fallback only when visible and no stream is active |
| balances | 15 s | 5 min | 2 | yes | yes | none |
| positions/orders/live account state | 10 s | 5 min | 2 | yes | yes | none |
| history | 30 s | 15 min | 3 | no | yes | none |

Dynamic financial data never uses permanent freshness. Confirmed mutations use
targeted invalidation, so active observers refresh immediately while inactive
observers remain stale until they next mount.

The prices/depth fallback poll is mutually exclusive with a live stream and is
disabled while the view is hidden.
