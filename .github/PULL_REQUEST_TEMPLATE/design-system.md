## Design-system checklist

Use this checklist when your PR changes design tokens, shared components in `packages/ui`, or introduces a new component to the design system.

See [AGENTS.md](../../AGENTS.md), especially [§2](../../AGENTS.md#2-never-weaken-a-check-to-make-it-pass) and [§3](../../AGENTS.md#3-fix-issues-completely), for the repository's complete-fix and no-suppression requirements.

### Root cause and regression coverage

- [ ] **Root cause stated** (for fixes/behavior changes): why the bad state was reachable, not just the symptom. Write "N/A" and explain why for non-fix changes.
- [ ] **Sibling instances checked**: searched for the same bug/pattern elsewhere and fixed them, or documented what remains in a linked follow-up issue.
- [ ] **Regression coverage**: named test(s) that fail before the fix and pass after, or explained why a regression test is not applicable. Add focused tests; do not skip/delete tests or weaken checks to get green.

### API compatibility

- [ ] Component API follows existing conventions: `className` forwarding, `cva` variants, `...props` spread last
- [ ] No breaking API changes without a **migration note** in the PR description (see changelog below)
- [ ] Subpath export added to `packages/ui/package.json` if this is a new component

### Theme & visual

- [ ] Verified in **light theme** and **dark theme**
- [ ] Verified at **mobile** viewport width (360px)
- [ ] No new raw hex colours, arbitrary font sizes, or arbitrary radius values — `bun run check:tokens` passes clean

### Accessibility

- [ ] Interactive elements are operable by **keyboard alone** (Tab, Enter/Escape, arrow keys where applicable)
- [ ] Correct ARIA roles and states are exposed (use Base UI primitives where possible)
- [ ] Colour is never the only signal — shape, label, or position accompanies any colour-coded state

### Testing

- [ ] Non-trivial logic includes a unit test (`*.test.tsx` alongside the component)
- [ ] Component added to the gallery (`apps/web/src/features/gallery/components/gallery-page.tsx`)
- [ ] Visual regression snapshots updated (`bun run test:e2e -- design-system-visual --update-snapshots`) and reviewed in the diff

### Changelog

- [ ] Entry added to [`packages/ui/CHANGELOG.md`](../../packages/ui/CHANGELOG.md) under the correct section (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Accessibility`)
- [ ] Breaking changes include a `### Migration note` subsection

### CI

- [ ] `bun run typecheck --filter=@workspace/ui` passes
- [ ] `bun run lint --filter=@workspace/ui` passes
- [ ] `bun run test:e2e -- design-system-visual` passes (or snapshots intentionally updated)
- [ ] No check was disabled, skipped, or weakened to obtain a passing result