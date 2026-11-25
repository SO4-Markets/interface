## Summary

<!-- What changed and why? -->

## Root cause and scope

<!-- Required for fixes and behavior changes. See [AGENTS.md §3](../../AGENTS.md#3-fix-issues-completely). -->

- **Root cause:** <!-- Why was the bad state reachable? Address the cause, not just the symptom. Write "N/A" for non-fix changes and explain why. -->
- **Sibling instances:** <!-- Did you search for the same bug/pattern elsewhere? List what you checked and what was fixed, or explain why none exist / what remains in a linked follow-up issue. -->
- **Complete fix:** <!-- Confirm the issue is fully addressed, or state exactly what is left and why. Do not leave partial workarounds. -->

## Regression coverage

- **Regression test(s):** <!-- Name the test(s) that fail before this fix and pass after, or explain why a regression test is not applicable. Add focused tests for behavior this change introduces/fixes; do not skip or delete tests to get green. -->

## Verification

- [ ] `bun lint`
- [ ] `bun typecheck`
- [ ] `bun run check:tokens`
- [ ] `bun run test`
- [ ] `bun run test:coverage`
- [ ] `bun run build`
- [ ] UI checked at 360px and desktop widths
- [ ] Keyboard and screen-reader behavior checked
- [ ] No check was disabled, skipped, or weakened to get green ([AGENTS.md §2](../../AGENTS.md#2-never-weaken-a-check-to-make-it-pass))

## Accessibility

<!-- Describe focus, keyboard, ARIA, and touch-target verification. -->

## Related issues

Closes #
