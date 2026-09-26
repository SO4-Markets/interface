# Docs performance budget (DX-060)

This file documents the committed budgets for `apps/docs` and the measured baseline at the time they were set. Future changes must argue against this baseline.

## Budgets (committed)

| Asset | Budget | Measured (2026-09-04) | Headroom |
|-------|--------|-----------------------|----------|
| Initial JS (largest chunk) | 400 KB | 291 KB | 109 KB |
| Initial CSS (largest) | 160 KB | 119 KB | 41 KB |
| Largest HTML page | 120 KB | 53 KB | 67 KB |
| Search index (pagefind, lazy) | 1100 KB | 814 KB | 286 KB |

*All sizes are raw bytes /1024 (uncompressed). JS/CSS are Vite chunks in `.nitro-static/assets`. HTML is max `index.html` in `.nitro-static`.*

Source of truth: `apps/docs/budgets.json`. Vite (`vite.config.ts` → `docsBudgetGuard`) enforces JS/CSS at build time; `scripts/check-budget.ts` enforces HTML and search-index and is run in CI after `build`.

## Why these numbers

- **Initial JS 400 KB** — Docs is build-time MDX + build-time Shiki/Mermaid; client JS is only sidebar, theme toggle, search dialog, reading progress, and version picker. Adding a large client library (e.g. `chart.js` ~500 KB, `lodash` full) will breach the budget and fail CI. Demonstrate by importing `chart.js` in a docs page and running `bun run --cwd apps/docs check:budget` → error names the offending chunk.
- **Initial CSS 160 KB** — Tailwind v4 + `@workspace/ui` tokens; docs defines no extra tokens (DESIGN.md). The bulk is the shared theme: `globals.css` declares its palette under `@theme static`, which emits the full token set on `:root` whether or not docs references it, plus the landing-only `@utility` classes. Trimming that is a design-system change, not a docs one — until then the budget tracks what the shared stylesheet actually costs.
- **Largest HTML 120 KB** — Longest concept/guide is ~1100 words + code; the 67 KB of headroom allows several more long pages without breach.
- **Search index 1100 KB** — Pagefind index is lazily loaded (`/pagefind/pagefind.js` defer, not in initial HTML), so it costs nothing on first paint; the budget exists to force pruning before it grows without bound. Pagefind ships a WASM search runtime plus per-page fragments, which is most of the 814 KB.

## Re-baselined 2026-09-04

The numbers first committed with DX-060 (JS 185 KB, CSS 42 KB, HTML 78 KB, index 185 KB)
did not match any build of this app. Two of the four budgets they implied were
already breached the day they landed, so `bun run build` (Vite guard, CSS) and
`bun run --cwd apps/docs check:budget` (search index) failed on every run:

| Asset | Recorded as measured | Actually measured 2026-09-04 |
|-------|----------------------|------------------------------|
| Initial JS (largest chunk) | 185 KB | 291 KB |
| Initial CSS (largest) | 42 KB | 119 KB |
| Largest HTML page | 78 KB | 53 KB |
| Search index (pagefind) | 185 KB | 814 KB |

The table above is the first baseline taken from a real `bun run --cwd apps/docs build`
followed by `check:budget`. Budgets are set at roughly 1.35x the measured size, so a
large client library still breaches them. Nothing about the app's size changed in this
re-baseline — only the recorded numbers, which are now the ones a build produces.

## Enforcement

```bash
# Vite guard (JS/CSS) — runs inside `bun run --cwd apps/docs build`
# Fails build with: [docs-budget] Initial JS budget exceeded! Chunk "..." is ... KB

# HTML + search-index guard — runs after build
bun run --cwd apps/docs check:budget
# On breach, report names offending asset, e.g.:
# - Largest HTML budget exceeded: 145.20 KB > 120 KB ... Offending asset: /concepts/risk/index.html
# - Search index in initial payload: HTML "/index.html" references pagefind in blocking script

# Lighthouse CI — mobile, representative pages
bun run --cwd apps/docs build && bunx lhci autorun --config=./lighthouserc.json
# Thresholds: performance ≥0.80, accessibility ≥0.90, best-practices ≥0.90 (mobile)
```

CI runs `check:budget` after `build` and runs Lighthouse via `lighthouserc.json`. Thresholds are currently met (see `lighthouserc.json`).

## Updating budgets

To increase a budget intentionally:

1. Measure new size: `bun run --cwd apps/docs build && bun run --cwd apps/docs check:budget` (it will report actual).
2. Edit `budgets.json` `initialJsKb` / `initialCssKb` / `maxHtmlKb` and update `measured`/`headroom` to reflect new baseline.
3. Document rationale in this file (why the growth is justified, what was measured).
4. Commit with files `budgets.json` + `BUDGET.md` + the change that grew the bundle.

Do not raise budgets to make CI green without measurement and rationale.

## Search index not in initial payload

Guaranteed by:

- No `<script src="...pagefind...">` in any `.nitro-static/**/*.html` (checked by `check-budget.ts`).
- Pagefind is loaded lazily via `pagefind --site` output and `defer` dynamic import in `SearchDialog`.

If a page imports pagefind statically, `check:budget` will fail naming the offending HTML.
