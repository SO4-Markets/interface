# OB-130 release evidence package

Season acceptance gates for the order-book trading experience. Publishing or
deployment remains a **separate explicitly authorized** action.

## Issues covered

| Issue | Title | Evidence |
| --- | --- | --- |
| #782 / OB-127 | Full trading accessibility journey | `e2e/trade-a11y-journey.spec.ts`, MarketSelector Escape/focus restore |
| #783 / OB-128 | Visual + long-session regression | `e2e/trade-workspace-visual.spec.ts`, `e2e/trade-long-session.spec.ts`, `docs/ob_1/long-session-report.md` |
| #784 / OB-129 | User/contributor docs | `apps/docs/content/guides/trading.mdx`, `troubleshooting.mdx`, `concepts/order-types.mdx`, CONTRIBUTING motion/toast notes |
| #785 / OB-130 | Release evidence | This document |

## Ordered AGENTS.md gate (local)

Run from repository root before merge:

```bash
bun lint
bun typecheck
bun run check:tokens
bun run check:content
bun run test
bun run test:coverage
bun run build
bun run changelog:validate
```

Record actual results on the release candidate (do not invent greens):

| Check | Result | Notes |
| --- | --- | --- |
| `bun lint` | FAIL (pre-existing on main) | web package already red with import/parse issues unrelated to this PR |
| `bun typecheck` | FAIL (pre-existing on main) | Remaining errors in chart/orderbook/stellar after restoring corrupted hooks |
| `bun run check:tokens` | FAIL (pre-existing) | DepthChart/DepthLadder arbitrary text sizes |
| `bun run check:content` | PASS | Ran locally |
| `bun run test` | PARTIAL | MarketSelector unit tests PASS (16/16); full suite blocked by main type errors |
| `bun run test:coverage` | NOT RUN | Blocked by typecheck baseline |
| `bun run build` | NOT RUN | Blocked by typecheck baseline |
| `bun run changelog:validate` | FAIL (pre-existing) | Multiple unreleased entries missing frontmatter |
| Integration checks (if web/indexer touched) | _fill_ | See AGENTS.md §1 |

## Motion review (findings table)

Purpose: restrained trading feedback; Escape/focus first; reuse UI toast.

| Finding | Severity | Verdict |
| --- | --- | --- |
| Market selector dismiss restores focus on Escape | Pass | Required for overlay interruption |
| Trade ticket / book use existing duration tokens only | Pass | No new motion library |
| Reduced-motion fixtures in visual + a11y e2e | Pass | `reducedMotion: "reduce"` |
| Live price ticks do not assertively spam `aria-live` | Pass | Polite/status regions only |
| Sonner / second toaster | N/A | Not introduced |

Rapid-interruption evidence: Escape closes market listbox and returns focus to
the trigger in unit + e2e coverage.

## Execution / freshness / accessibility blockers (not hidden)

From `docs/order-book-execution-model.md` — still **external** until protocol
owners supply evidence:

- Native price-time matching / resting level-2 depth
- Partial fill quantity + remaining quantity API
- Matched-book settlement API distinct from pool keeper execution

UI completion must not claim these capabilities. Confirmed transactions remain
submission/ledger proof only.

## Rollout / rollback

1. **Rollout:** merge PR → run gate on `main` → authorize deploy separately.
2. **Rollback:** revert the merge commit; no schema migration is required for
   these client/docs/e2e changes. Feature flags are unchanged.
3. **Monitoring:** watch trade a11y e2e, long-session JSON sample, and oracle
   staleness indicators after deploy.

## Changelog

User-visible docs updates ship with a `.changelog/unreleased/` entry (`area:
docs` and/or `trade` as appropriate).
