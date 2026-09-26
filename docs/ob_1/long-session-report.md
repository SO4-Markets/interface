# Long-session regression report (OB-128)

Automated harness: `e2e/trade-long-session.spec.ts`.

## Scenario

Bounded trading session on `/trade` with repeated:

- Long / Short ticket tab switches
- Positions / Orders / History bottom-tab switches
- Stubbed Binance + oracle network (no live internet)

## Metrics recorded

| Metric | Source | Pass rule |
| --- | --- | --- |
| Input latency | Timed Long→Short click pair | `< 2000 ms` lab proxy |
| Active timers | Instrumented `setTimeout` / `setInterval` | Growth `≤ +25` vs baseline |
| JS heap | `performance.memory.usedJSHeapSize` when available | `< 3× baseline + 8 MB` |
| Request count | Playwright `request` events | `0 < n < 5000` |

## Latest local / CI sample

Run:

```bash
bun run test:e2e -- trade-long-session
```

The spec prints a JSON sample (`baseline`, `after`, `delta`) to the test log.
Paste the latest passing sample here when cutting a release candidate:

```json
{
  "name": "trade-long-session",
  "baseline": { "heap": 0, "timerCount": 0, "requests": 0, "inputLatencyMs": 0 },
  "after": { "heap": 0, "timerCount": 0, "requests": 0, "inputLatencyMs": 0 },
  "delta": { "heap": 0, "timerCount": 0, "requests": 0 },
  "note": "Replace with the console JSON from a green run."
}
```

## Interpretation

- Unexplained heap or timer growth blocks OB-128 completion.
- Listener counts are not directly enumerated in Chromium without DevTools
  protocol extensions; timer instrumentation is the shipped proxy for abandoned
  subscriptions in this harness.
- Cache retention policy that backs this scenario:
  `apps/web/src/features/trade/lib/cache-retention-long-session.md`.
