<!--
  Documentation PR template. Use it by adding ?template=documentation.md to the
  compare URL, or picking "documentation" from the template dropdown.
  Guide: apps/docs/CONTRIBUTING.md · Spec: docs/dx_1/003_content_map.md §4
-->

## Page(s)

<!-- Route and file for each page, e.g. /guides/pools — apps/docs/content/guides/pools.mdx -->

- Route: `/`
  File: `apps/docs/content/`
  Issue: closes #

## Reader

<!-- Which of the three readers from content map §1 is this page for? Trader, liquidity provider, or integrator/contributor. One primary reader per page. -->

Primary reader:

## Sources

<!--
  Every claim about protocol mechanics must name the file it came from.
  One row per claim. "The faucet cooldown surfaces as contract error code 6"
  → apps/web/src/features/faucet/hooks/useClaim.tsx
-->

| Claim in the page | Source file |
| ----------------- | ----------- |
|                   |             |

## Worked example

<!-- Paste the inputs, the arithmetic, and the result. The numbers must have been computed, not estimated. If the page has no worked example, say why it does not need one. -->

## Definition of done (content map §4)

- [ ] The page exists at its mapped path with valid frontmatter (`title` ≤ 60, `description` 50–160, real `updated:` date, valid `status`).
- [ ] `bun run --cwd apps/docs check:content` passes.
- [ ] `bun run --cwd apps/docs check:links` passes.
- [ ] `bun run --cwd apps/docs lint:prose` passes with no new warnings.
- [ ] Every mechanical claim above names its source file.
- [ ] The worked example's numbers were computed, not estimated.
- [ ] The page is listed in `apps/docs/content/meta.json` in content-map order (or, for `/index`, is intentionally excluded).
- [ ] Reading level fits the target reader.
- [ ] Renders correctly in light and dark themes at a mobile and a desktop width.
- [ ] For guides: every documented action was performed by the author on testnet — confirmed here:

## Anything unverified

<!-- List any claim a maintainer still needs to confirm, and set the page's status to `draft` until they have. "None" is a valid answer. -->

## Changelog

- [ ] Added `.changelog/unreleased/<pr>-<slug>.md` with `area: docs` (see `.changelog/unreleased/README.md`).
