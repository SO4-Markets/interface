## Summary

This PR implements the complete changelog pipeline across four dependent issues:

### DX-005 (#517): Parse CHANGELOG.md into typed JSON
- `scripts/changelog/parse.ts` — pure parser library with types
- `scripts/changelog/build.ts` — CLI emitting `apps/web/public/changelog.json`
- Handles [YANKED] markers, missing PR links, absent areas, pre-tooling entries
- SemVer ordering (0.10.0 > 0.9.0), malformed heading fails with line number
- Fixture + tests asserting snapshot, semver sort, malformed detection

### DX-007 (#519): ReleaseSection & ChangelogEntry components
- `InlineMarkdown.tsx` — safe inline markdown renderer (links, code, emphasis, bold) producing React elements, never innerHTML
- `ChangelogEntry` — adds area label, uses `InlineMarkdown`, PR link when present
- `ReleaseSection` — uses shared DS-072 `formatDate` helper, YANKED badge + muted treatment, Divider from DS-080
- Unit tests: entry with/without PR, without area, yanked release, HTML injection, locale-stable dates

### DX-014 (#526): Atom feed for releases
- `scripts/changelog/feed.ts` — emits valid Atom 1.0 at `apps/web/public/changelog.xml`
- Cap 50 releases, stable tag-URI ids (`tag:so4.market,{date}:v{version}`)
- XHTML content with markdown→XHTML conversion, no raw HTML leak
- `<link rel="alternate" type="application/atom+xml">` in document head
- Tests: well-formed Atom, stable ids across rebuilds, HTML escape

### DX-022 (#534): Visual regression for /changelog
- `e2e/changelog-visual.spec.ts` — 5 states (default, filtered, searched, empty, error) × 2 themes × 2 viewports = 20 baselines
- Deterministic committed fixture (`e2e/fixtures/changelog.json`) shared with unit tests
- Baselines stable across 3 consecutive runs

## Testing
- `bun lint` — passes (zero errors)
- `bun run check:tokens` — passes (zero violations)
- `bun run test` — all pass
- `bun run test:coverage` — thresholds met
- `bun run build` — succeeds
- Visual regression baselines stable across 3 runs

## Pre-existing issues
Typecheck has pre-existing errors on main (unrelated to this PR):
- `afterAll` not found in a11y.test.tsx
- Route type error in changelog.tsx
- Unused variables in test files
- Playwright `setOfflineMode` API
- Unused React import in packages/ui/select.tsx

Closes #519, #517, #534, #526