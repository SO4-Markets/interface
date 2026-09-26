# Design System

This document is the source of truth for SO4's design tokens: what they are, why they exist, and how to keep new code from drifting away from them. It exists because 250+ ad hoc arbitrary values (`text-[13px]`, raw hex colors, etc.) had already accumulated across the app before this pass — see the [DS-050 audit](#audit-history) below for how that happened and what was done about it.

## Where the tokens live

All tokens are defined in [`packages/ui/src/styles/globals.css`](./packages/ui/src/styles/globals.css), a Tailwind v4 CSS-first `@theme` block. There is no `tailwind.config.js` — everything is a CSS custom property, consumed via Tailwind utility classes.

### Color

Colors are defined as `oklch()` values in `:root` (light theme) and `.dark` (dark theme), then exposed to Tailwind via `@theme inline` (`--color-background`, `--color-primary`, etc.). Always reach for a semantic name (`bg-background`, `text-muted-foreground`, `border-border`) over a raw palette color (`bg-zinc-900`) — semantic names are what make the light/dark split work automatically.

#### Surface roles

The app uses five explicit surface layers instead of the generic shadcn page/card/popover pattern. Each has a Tailwind utility via the `@theme inline` mapping:

| Token | Tailwind | Purpose |
|---|---|---|
| `--surface-canvas` | `bg-surface-canvas` | Base page background |
| `--surface-sunken` | `bg-surface-sunken` | Inset/recessed areas (well containers, stat cards) |
| `--surface-raised` | `bg-surface-raised` | Elevated above canvas (cards, panels) |
| `--surface-overlay` | `bg-surface-overlay` | Floating on top of everything (modals, popovers) |
| `--surface-interactive` | `bg-surface-interactive` | Hoverable/active areas (buttons, table rows) |

The existing `--background`, `--card`, `--popover` shadcn aliases remain for backwards compatibility during migration but new code should prefer the surface tokens.

#### Text and icon roles

Explicit text roles replace scattered opacity modifiers. Each maps to a Tailwind `text-*` utility:

| Token | Tailwind | Usage |
|---|---|---|
| `--text-primary` | `text-text-primary` | Default body text, headings |
| `--text-secondary` | `text-text-secondary` | Supporting labels, descriptions |
| `--text-tertiary` | `text-text-tertiary` | Placeholders, hints, metadata |
| `--text-disabled` | `text-text-disabled` | Inactive UI elements |
| `--text-inverse` | `text-text-inverse` | Text on solid color fills (badges, buttons) |
| `--text-link` | `text-text-link` | Interactive/navigation text |

#### Trading-state and semantic market colors

Each trading state (long, short, liquidation) and semantic status (success, warning, info, danger, neutral) has a foreground, subtle background, and border token. Color is never the only signal — shape, position, or label should accompany it.

| Token family | Foreground | Subtle | Border | Tailwind |
|---|---|---|---|---|
| `long` | `--long-foreground` | `--long-subtle` | `--long-border` | `bg-long-subtle border-long-border` |
| `short` | `--short-foreground` | `--short-subtle` | `--short-border` | `bg-short-subtle border-short-border` |
| `liquidation` | `--liquidation-foreground` | `--liquidation-subtle` | `--liquidation-border` | `bg-liquidation-subtle border-liquidation-border` |
| `success` | `--success-foreground` | `--success-subtle` | `--success-border` | `bg-success-subtle border-success-border` |
| `warning` | `--warning-foreground` | `--warning-subtle` | `--warning-border` | `bg-warning-subtle border-warning-border` |
| `info` | `--info-foreground` | `--info-subtle` | `--info-border` | `bg-info-subtle border-info-border` |
| `danger` | `--danger-foreground` | `--danger-subtle` | `--danger-border` | `bg-danger-subtle border-danger-border` |
| `neutral` | `--neutral-foreground` | `--neutral-subtle` | `--neutral-border` | `bg-neutral-subtle border-neutral-border` |

Chart colors (`chart-1` through `chart-5`) are mapped to the same semantic palette (`long`, `short`, `liquidation`, `info`, `neutral`) so the entire app uses one consistent color language.

#### When to use Geist Mono

Geist Mono is available via `@fontsource-variable/geist` but is **not** the default body font. Use it for:
- Order book prices and sizes (monospaced alignment is critical)
- Address/transaction hash display
- Code snippets or technical values

Use Geist Variable (`font-sans`) for everything else.

### Radius

`--radius` is `0` at the root — this app's default visual language is sharp corners everywhere. The `--radius-sm/md/lg/xl/2xl/3xl/4xl` scale is derived from it via `calc()`, so as long as new UI uses `rounded-sm`/`rounded-lg`/etc. instead of an arbitrary value, changing `--radius` in one place re-skins the whole app's corner treatment.

### Micro-typography scale

The default Tailwind font-size scale (`text-xs`=12px, `text-sm`=14px, `text-base`=16px, `text-lg`=18px, `text-2xl`=24px, ...) has no steps between `xs` and `sm`, or below `xs` — but this app's dense, data-table-heavy UI (order books, position tables, referral stats) genuinely needs several. Rather than reach for `text-[13px]` per callsite, use the named scale defined alongside the default one:

| Token | Value | Token | Value |
|---|---|---|---|
| `text-9-5` | 9.5px | `text-12-5` | 12.5px |
| `text-10` | 10px | `text-13` | 13px |
| `text-10-5` | 10.5px | `text-13-5` | 13.5px |
| `text-11` | 11px | `text-14-5` | 14.5px |
| `text-11-5` | 11.5px | `text-15` | 15px |
| `text-17` | 17px | `text-22` | 22px |
| `text-26` | 26px | `text-40` | 40px |

These are named by their pixel value (at the default 16px root) rather than a semantic step name (`2xs`/`3xs`/...) — a dozen-plus half-pixel steps don't fit a small semantic vocabulary without the names becoming arbitrary themselves. If you need a size not in this list, check whether it's really necessary before adding a new one; if it is, add it here and to `globals.css` in the same PR so the two never drift apart.

### Motion: duration and easing

The motion token system (OB-011) centralizes timing and easing decisions so animations and transitions feel consistent across the trading and landing experiences. Durations are scaled by context (feedback timings are fastest; landing sequences are slowest); easing functions are reused across the app rather than defined per-component.

#### Duration scale

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100ms | Feedback: selection states, status changes, quick overlays |
| `--duration-base` | 150ms | Standard: most transitions, color changes, reveal animations |
| `--duration-moderate` | 200ms | Emphasis: section expansions, panel reveals, list animations |
| `--duration-slow` | 300ms | Landing: hero animations, feature reveals, marquees |
| `--duration-slowest` | 400ms | Landing: long sequences, extended hero motion |

Trading UI prefers shorter durations (fast/base/moderate) to keep the interface responsive. The landing page can use longer durations (slow/slowest) for more expressive motion that builds visual interest without impairing navigation.

#### Easing scale

| Token | Function | Use |
|---|---|---|
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for most transitions (acceleration + deceleration) |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entry animations (quick arrival, no overshoot) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations (slowing into rest) |
| `--ease-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful feedback (emphasizes non-critical state changes) |

#### Transition utilities

Named utilities provide explicit, consistent transitions:

- `transition-opacity` — opacity changes (tooltips, visibility toggling)
- `transition-transform` — position/scale changes (slides, reveals, expansions)
- `transition-all-subtle` — color, background, border, and opacity (status badges, interactive highlights)

Always name the properties you're animating (`transition-property: opacity, transform`) rather than `transition: all` — it's faster for the browser and makes the intent clear to reviewers. If you need simultaneous opacity + transform, compose the utilities or apply both properties to one element.

#### Reduced-motion support

The `prefers-reduced-motion` media query disables all named transitions (utilities set `transition-duration: 0` and animations to `animation-play-state: paused`). Never bypass this — it's a user accessibility requirement, not a style choice. The `useReducedMotion` hook (OB-012) provides reactive support for components that need to check the setting at runtime (SSR-safe, listens for system changes).

## Enforcement: the token-usage check

[`scripts/check-design-tokens.ts`](./scripts/check-design-tokens.ts) (run via `bun run check:tokens`, also wired into CI) scans `apps/web/src` and `packages/ui/src` for:

- raw hex colors (`#RGB`, `#RRGGBB`, etc.) outside a small file-level allowlist
- arbitrary Tailwind font-size classes (`text-[...]`)
- arbitrary Tailwind radius classes (`rounded-[...]`)

Not everything a scanner flags is actually wrong — some values are genuinely structural (a third-party charting library's imperative color config, an HTML `<meta>` tag's `content` attribute, viewport-relative fluid type) and can't be expressed as a Tailwind token at all. For those, either:

- add a `// ds-allow: <short reason>` comment on the flagged line (or the few lines above it, if the comment reads better wrapping a long `className`), or
- add the whole file to `ALLOWLIST` in the script, with a reason, if the exception applies file-wide.

Both are meant to be read, not grown by reflex — a `ds-allow` comment should explain *why*, not just suppress the check.

## Visual regression

[`e2e/design-system-visual.spec.ts`](./e2e/design-system-visual.spec.ts) (Playwright) takes screenshots of `/gallery` and every main route (`/`, `/trade`, `/pools`, `/earn`, `/referrals`, `/faucet`) at desktop and mobile widths, in both themes. Run it locally with:

```bash
bun run test:e2e -- design-system-visual
```

**Updating baselines:** when a change *intentionally* alters visual output, regenerate the reference screenshots with:

```bash
bun run test:e2e -- design-system-visual --update-snapshots
```

then review the diffs in `e2e/design-system-visual.spec.ts-snapshots/` in your PR — a baseline update should always be reviewable in the diff, not just silently regenerated. If a screenshot changed and you *didn't* expect it to, that's the suite doing its job — figure out why before updating the baseline.

## The component gallery (`/gallery`)

Trading surfaces use `--trading-panel-padding` and `--trading-row-height` for
compact panels. Depth fills use `--trading-depth-buy` and
`--trading-depth-sell`, with side labels and numeric alignment so color is not
the only state cue. `--trading-divider` is the shared low-emphasis divider
role. These roles have semantic light/dark values and should be consumed via
CSS variables or named utilities rather than raw colors or arbitrary sizes.

[`apps/web/src/features/gallery/components/gallery-page.tsx`](./apps/web/src/features/gallery/components/gallery-page.tsx) renders every `packages/ui` primitive across all its variants on one page. It's not linked from the app's main navigation (it's an internal dev/design tool, not a trader-facing page) — visit `http://localhost:3000/gallery` directly in a local dev server. It exists to:

- give reviewers one place to see every variant of a component at once instead of hunting through feature pages for one that happens to use the state you changed
- act as the fixed, deterministic target for the visual regression suite above
- provide an **RTL toggle** (top-right corner) that switches the page between left-to-right and right-to-left layout, making directional-CSS regressions visible at a glance

When you add a new component to `packages/ui`, add it to the gallery in the same PR — see [`packages/ui/CONTRIBUTING.md`](./packages/ui/CONTRIBUTING.md) for the full checklist.

## Separators and dividers

Borders are the cheapest way to make a layout look organised and the fastest way to make it look noisy. Linear's calm hierarchy comes from *space* and *surface* doing the grouping, with lines reserved for the few places where a relationship genuinely needs marking. [`packages/ui/src/components/separator.tsx`](./packages/ui/src/components/separator.tsx) (DS-080) exists so those few places look the same everywhere.

**Reach for these first, in order:**

1. **Spacing** — a bigger gap between two groups than within them. This is the default answer for stacked form fields, stat rows, and list items.
2. **Surface contrast** — `bg-surface-raised` / `bg-card` against `bg-surface-canvas`. A card edge already says "this is one thing", so an internal separator repeating that boundary is redundant.
3. **A separator** — only when two adjacent blocks are different *kinds* of thing and spacing alone leaves that ambiguous: a panel and its action footer, a menu's items and its destructive item, a table and its summary row.

**Tones.** `subtle` inside an already-grouped surface (card, popover, form), `default` between page or list sections, `strong` for the rare structural cut between regions belonging to different tasks. Anything heavier than `strong` is a sign the layout wants a surface change instead of a line.

**Semantics.** Pass `decorative` whenever the line is purely visual — which is most of the time. Headings, lists, and landmarks usually already carry the structure, and every announced separator is one more thing a screen-reader user listens past. Leave it semantic only when the line is the *only* thing expressing the grouping.

**Labelled dividers.** `<Divider label="or" />` names a break instead of just drawing one — grouped form sections, "or" between auth methods, date breaks in a feed. The rules are decorative and the label is ordinary text, so assistive technology reads the words rather than the geometry. Label contrast comes from `text-text-secondary`, which holds up in light, dark, and high-contrast themes.

Existing page borders were left alone in DS-080; migrate them opportunistically when you're already touching the markup.
## Right-to-left (RTL) support

### Logical CSS properties

The design system uses **logical CSS properties** instead of physical directional properties wherever the behaviour is semantic (i.e. describes content flow rather than a fixed visual direction):

| Physical | Logical equivalent |
|---|---|
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `translate-x` | Use `inset-inline-start` + `translate` or percent-based |

Tailwind v4 provides logical utility classes — `ms-*`, `me-*`, `ps-*`, `pe-*`, `border-s-*`, `border-e-*`, `text-start`, `text-end`, `inset-inline-start-*`, `inset-inline-end-*` — which map to the correct physical side at runtime based on the `dir` attribute.

### Justified physical directions

Some directional properties are intentionally kept physical:

- **Numeric financial values**: columns containing prices, sizes, volumes, APY, and other numbers use `text-right` (not `text-end`) because financial convention requires right-aligned digits in all locales, regardless of script direction.
- **Chart time flow**: time-series charts (candlesticks, line charts) render left-to-right regardless of page direction, per financial-market convention.
- **Data-attributed sides**: components that accept a physical `side` prop (e.g. `sheet` with `side="left"` or `side="right"`, tooltip arrow positioning for `data-[side=left]`/`data-[side=right]`) remain physical because they refer to the screen-relative position, not the content-flow direction. The logical `inline-start` / `inline-end` variants are also supported for direction-aware placement.

### DirectionProvider

A `DirectionProvider` (in `apps/web/src/ui/direction-provider.tsx`) persists the chosen direction to `localStorage` under `so4-direction` and sets the `dir` attribute on `<html>`. It wraps the app in the provider tree alongside `ThemeProvider`.

### RTL gallery fixture

The component gallery at `/gallery` includes an RTL/LTR toggle button (top-right corner). Use it during development and review to verify that:

- Dialogs, menus, fields, tabs, breadcrumbs, tables, and navigation remain usable in RTL
- Leading/trailing icons and controls mirror correctly
- Focus order follows DOM order and remains logical
- Numeric financial values preserve readable direction

The visual regression suite (`e2e/design-system-visual.spec.ts`) captures gallery screenshots in both directions across all themes and viewports. Run `bun run test:e2e -- design-system-visual` to verify, or `bun run test:e2e -- design-system-visual --update-snapshots` to update baselines after an intentional change.

## GMX reference palette and landing theme (GF3)

`packages/ui/src/styles/globals.css` carries a namespaced `--color-gmx-*` palette, landing font stacks (`--font-landing-sans` = Archivo, the OFL stand-in for GMX's paid TTHoves; `--font-landing-code` = Space Mono), landing typography/button utilities (`text-heading-1…4`, `text-subheadline`, `text-description`, `btn-landing`), and helpers (`border-hairline`, `scrollbar-hide`, `animate-pause`, `--animate-scroll`). These are **source material for the GrantFox 3 theme revamp**, not tokens for general app use — app components keep using the semantic tokens above; only the dark theme (GF3-001) and the landing route consume the `gmx-*` set. The full GMX token reference, licensing notes, and the GMX→SO4 mapping table live in [`docs/gf_3/001_theme_update.md`](./docs/gf_3/001_theme_update.md); the landing spec in [`docs/gf_3/002_landing_page.md`](./docs/gf_3/002_landing_page.md).

### Dark theme (GF3-001)

`.dark` in `globals.css` had been removed at some point, so toggling to dark mode silently fell back to the light values above. GF3-001 (re)introduces it, this time derived from the GMX reference palette instead of an arbitrary dark scale — surfaces, text roles, `border`/`input`, `primary`/`ring`, and `accent` all resolve to a `--color-gmx-*` value per the mapping table in [`001_theme_update.md` §8.2](./docs/gf_3/001_theme_update.md#82-layer-2--semantic-dark-theme-what-gf3-001-applies). Trading-state colors (`long`/`short`/`liquidation`, `success`/`warning`/`danger`, `neutral`) are not GMX concepts, so their foreground values are untouched — only their `subtle`/`border` fill pairs are re-lightened in `.dark`, because the `:root` pairs were tuned to sit on a white page and read as almost-black on the new slate-800/900 surfaces. `--info` is the one status color that does move, to `--color-gmx-blue-400`, since "informational blue" is the same concept as GMX's brand blue. The light theme (`:root`) is unchanged.

The landing route (`apps/web/src/routes/index.tsx`) forces this `.dark` scope on its own root element regardless of the user's theme setting — GMX's landing has no light variant — by adding the `dark` class directly rather than touching `<html>`, so the override never leaks into `/trade`, `/pools`, `/earn`, `/referrals`, or `/faucet`.

## Audit history

- **DS-050** (this pass): found and fixed 268 arbitrary-value violations (229 arbitrary font sizes, 38 raw hex colors, 1 arbitrary radius) across ~40 files. Of these:
  - 225 font-size instances were mechanically migrated to either an existing Tailwind default (`text-xs`/`sm`/`base`/`lg`, for values that turned out to already match) or the new micro-typography scale above — a pure rename with the exact same numeric value, so zero visual change.
  - 16 raw hex colors in an SVG chart illustration turned out to be exact Tailwind palette values (`emerald-400`, `red-400`) hardcoded as hex instead of using `fill-emerald-400`/`stroke-emerald-400` — converted, also zero visual change.
  - 2 raw hex colors driving a dynamic SVG `stroke` prop were converted to a conditional Tailwind class instead of a JS color variable.
  - The remainder (a third-party charting library's config object, an HTML meta tag, fluid viewport-relative display type, and one isolated decorative radius) are structurally unable to use a Tailwind token and are documented via `ds-allow` comments or the script's file-level allowlist instead of being forced into the scale.
