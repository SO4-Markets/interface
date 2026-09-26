# Contributing to the SO4 documentation

This guide covers documentation content only — MDX pages under
`apps/docs/content/`. For code, the toolchain, and the commit gate, read the
root [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and [`AGENTS.md`](../../AGENTS.md).

The information architecture, reader personas, and page contract this guide
enforces are defined in
[`docs/dx_1/003_content_map.md`](../../docs/dx_1/003_content_map.md). This file
makes those rules runnable; the content map is the source of truth if the two
ever disagree.

---

## Where content lives

```
apps/docs/
  content/
    index.mdx              docs home (exempt from the sidebar; see meta.json note)
    get-started/*.mdx
    concepts/*.mdx
    guides/*.mdx
    developers/*.mdx
    reference/*.mdx         includes *.generated.mdx — do not hand-edit those
    resources/*.mdx
    meta.json               the sidebar manifest — every page except /index is listed here
  templates/                copy-me starting points: concept.mdx, guide.mdx, reference.mdx
  PROSE_STYLE.md            the full voice guide; prose lint enforces a subset
  REVIEWER_CHECKLIST.md     what a reviewer checks before approving
  scripts/                  check-content.ts, check-links.ts, lint-prose.ts
```

A page's route is its path under `content/` with `.mdx` removed:
`content/guides/pools.mdx` serves at `/guides/pools`.

## The frontmatter contract

Every page starts with a fenced frontmatter block. The parser
(`scripts/content.ts`) is line-based `key: value` — no nested keys, no
multi-line values, no comments.

```mdx
---
title: Pools
description: Adding and removing liquidity in an SO4 GM pool, what a deposit is exposed to, and how to exit a position.
updated: 2026-08-31
status: stable
---
```

| Key           | Rule (`scripts/check-content.ts`, `src/lib/frontmatter.ts`)              |
| ------------- | ---------------------------------------------------------------------- |
| `title`       | 1–60 characters. Appears in the sidebar and the browser tab.          |
| `description` | 50–160 characters. Used for search and social cards.                 |
| `updated`     | `YYYY-MM-DD`. Set it to the date you finished the page.              |
| `status`      | `stable`, `beta`, or `draft`. Use `draft` if a maintainer still needs to verify claims. |

Optional keys the schema allows: `sidebarLabel`, `order`, `tags`.

## Adding a page to the manifest

`content/meta.json` is the sidebar. A page that is not listed there fails
`check:content` with `orphan page /your/route`, and a listed page that does not
exist fails with `sidebar references missing /your/route`.

Add your route (path without the leading slash) to the right section's `pages`
array, in the order it appears in the content map §2:

```json
{
  "label": "Guides",
  "pages": ["guides/pools", "guides/earn", "guides/referrals", "guides/faucet", "guides/troubleshooting"]
}
```

`/index` is the one deliberate exception — it is the home page and is not in
the sidebar.

## The page contract (content map §3)

Every page:

1. **Answers its title question in the first paragraph**, before any scrolling.
2. **Carries one worked example with real numbers you computed**, not estimated.
   "A 10x long on 100 USDC liquidates at roughly a 9.1% adverse move" is
   checkable; "leverage is risky" is not.
3. **Links to adjacent concepts inline**, where the reader needs them — not in a
   trailing "see also" list.
4. **States a true `updated:` date.**

And avoids screenshots of weekly-changing UI, numbers that will silently rot
(fees, addresses, schema — those come from the `*.generated.mdx` reference
pages), and second-person imperative stacked ten deep.

## Which checks to run

From the repository root, or with `--cwd apps/docs`:

```bash
bun run --cwd apps/docs check:content     # frontmatter, manifest, orphans, alt text, glossary
bun run --cwd apps/docs check:links       # internal links and heading anchors resolve
bun run --cwd apps/docs lint:prose        # banned words, capitalisation, exclamation marks
bun run --cwd apps/docs check:faq         # only if you touched resources/faq.mdx
```

`bun run --cwd apps/docs check:content -- --fix` mechanically fixes the
`updated:` date and manifest ordering — nothing else.

These three checks run in CI (`.github/workflows/ci.yml`, "Documentation
content and prose checks" and "Documentation link and FAQ drift checks"). Run
them locally before you commit; a gate you did not execute did not pass.

## Voice rules

Prose lint (`scripts/lint-prose.ts`) fails the build on:

- **Exclamation marks** in prose.
- **The words `simply`, `just`, `obviously`, `easy`, `easily`.** If it were
  simple the page would not exist.
- **Lower-cased `soroban`, `stellar`, `freighter`, `turborepo`** — capitalise
  them. Contract names are `OrderVault`, `ExchangeRouter`, `SyntheticsReader`,
  `DataStore`; never write them hyphenated in prose.

It warns (does not fail) on passive voice and sentences over 30 words. Treat the
warnings as review comments from the linter.

The rest of the voice guide — plain, specific, unhurried; concrete nouns over
abstract ones; hedge only when the uncertainty is real and then name it — is in
[`PROSE_STYLE.md`](./PROSE_STYLE.md).

## Previewing locally

```bash
bun install
bun run --cwd apps/docs dev
```

This builds the content and starts the Nitro dev server. Open the printed URL,
find your page in the sidebar, and check it in both light and dark themes at a
mobile and a desktop width.

## Visual regression testing

Visual regression specs under `e2e/docs-visual.spec.ts` test the layout shell, kitchen-sink MDX fixture, sidebar, TOC, search dialog, and 404 page across light and dark themes on desktop and mobile viewports.

To run the visual suite:

```bash
bun run test:e2e -- docs-visual
```

To update baselines after deliberate UI token or chrome changes:

```bash
bun run test:e2e -- docs-visual --update-snapshots
```

Review the resulting diffs in `e2e/docs-visual.spec.ts-snapshots/` before committing.

## Sourcing claims

Every statement about protocol mechanics must be traceable to contract code,
the indexer, or `apps/web` behaviour — and the PR description must name the
file. "The faucet rejects a repeat claim with contract error code 6
(`ClaimTooSoon`), surfaced as a cooldown message"
(`apps/web/src/features/faucet/hooks/useClaim.tsx`) is sourced. "The faucet has
a cooldown" is not.

If the code does not handle a case, the page says so. A page that describes
intended behaviour as if it were current behaviour is worse than no page.

## Opening the PR

Use [`.github/PULL_REQUEST_TEMPLATE/documentation.md`](../../.github/PULL_REQUEST_TEMPLATE/documentation.md).
Append `?template=documentation.md` to the compare URL, or pick it from the
template dropdown. It mirrors the content map's definition of done (§4): the
page exists at its mapped path, the three checks pass, every mechanical claim
names its source file, the worked example's numbers were computed, and the page
is listed in `meta.json`.
