# Landing motion review (OB-027–OB-030)

Reviewed on 23 September 2026 against issues #674–#677.

The issue-mandated `.agents/skills/animate/SKILL.md` and
`.agents/skills/review-animations/SKILL.md` files are not published in this
repository. This review therefore applies the complete fallback workflow
reproduced in the issue bodies: state the purpose, use existing tokens and the
smallest implementation, verify normal and reduced motion, exercise rapid
interruption, and record findings and a verdict.

## Motion decisions

| Interaction                         | Purpose                                                                              | Properties and timing                                           | Reduced motion / interruption                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile navigation                   | Preserve spatial context while the full-screen menu enters and leaves.               | `opacity` and `translateY`, 180 ms, existing landing easing.    | Keyboard activation and `prefers-reduced-motion` are immediate. Escape closes once and restores the trigger focus. Reversal uses CSS transitions from the current visual state. |
| FAQ disclosure                      | Connect each question to its answer without measuring a changing pixel height.       | Grid track plus answer `opacity`, 200 ms.                       | Both transitions are disabled. Batched toggles use a synchronously updated state ref, so odd/even rapid input cannot read stale state. Closed links are `inert`.                |
| Pool cards                          | Confirm hover on a pointer-capable device without moving surrounding layout.         | Transform-only feedback, 180–300 ms.                            | Every transform is guarded by `motion-safe`; touch has no automatic movement.                                                                                                   |
| Hero title                          | Show the available markets and platform attributes without shifting the heading box. | Transform and `opacity`, 250 ms, with a 2.5 s reading interval. | A live media-query change stops the interval immediately and resets the word to an idle state. The interval and any in-flight timeout are both removed on cleanup.              |
| Social highlights and partner cards | Keep all claims and partners readable at once.                                       | Static grid with reserved card dimensions; no track animation.  | The complete presentation is identical under reduced motion.                                                                                                                    |

## Reproducible browser audit

Run the production-mode testnet build, record the normal/reduced-motion clips,
and attach the JSON evidence emitted by every case:

```bash
PLAYWRIGHT_LANDING_AUDIT=1 PLAYWRIGHT_MOTION_EVIDENCE=1 \
  bun run test:e2e -- e2e/landing-journey.spec.ts \
  --project=chromium --workers=2
```

Profile: Playwright 1.62.1 Chromium on Linux, local loopback, production build,
testnet configuration, external price endpoints stubbed with deterministic empty
responses. Viewports are 390×900, 768×900, and 1440×900. These are lab results,
not field percentiles.

| Viewport | Motion  |      CLS | Requests | Transfer bytes |
| -------- | ------- | -------: | -------: | -------------: |
| 390×900  | Normal  | 0.000047 |       17 |        455,644 |
| 390×900  | Reduced | 0.000047 |       17 |        455,644 |
| 768×900  | Normal  |        0 |       17 |        455,644 |
| 768×900  | Reduced |        0 |       17 |        455,644 |
| 1440×900 | Normal  |        0 |       17 |        455,644 |
| 1440×900 | Reduced |        0 |       17 |        455,644 |

Playwright stores one WebM clip per case below `test-results/` when
`PLAYWRIGHT_MOTION_EVIDENCE=1`. That directory is intentionally ignored; attach
the six generated clips to the pull request instead of committing binary test
artifacts.

## Findings

| Issue                | Evidence                                                                                                                                                                                         | Finding                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #674 navigation      | Mobile open/close, Escape restoration, focus containment, header/content geometry, anchor offset, and CTA route navigation run in Chromium.                                                      | Pass. A competing Escape listener was removed by giving the shared menu hook one restoration callback.                                                                           |
| #675 FAQ             | Batched triple toggle, long injected answer, 2× CSS browser zoom, narrow viewport, keyboard focus, `inert` links, and computed reduced-motion styles.                                            | Pass. Rapid toggles previously used render-time state and could finish in the wrong state; the regression is covered at component and browser levels.                            |
| #676 social/partners | Every social highlight appears exactly once at all viewports; there is no automatic track; cards have stable dimensions and pool hover transforms are motion-safe.                               | Pass. Static content remains complete for keyboard, touch, and reduced-motion users.                                                                                             |
| #677 journey         | Six production journeys validate content, no horizontal overflow, CLS ≤ 0.1, transfer evidence, FAQ interruption, menu focus, CTA navigation, and no running landing animation after route exit. | Conditional pass. The implementation and reproducible lab audit pass, but OB-010 (#657) is still open, so no authoritative route transfer target or field comparison exists yet. |

## Verdict

No blocking implementation or motion-review finding remains in this change.
Release comparison against an approved performance baseline remains blocked on
OB-010. The build also reports existing non-fatal warnings for a malformed
generated CSS comment and chunks above Vite's 500 kB advisory threshold; the
configured 2,000 kB per-chunk guard still passes. Re-run this audit after OB-010
lands and compare its route-specific budgets before treating these lab numbers
as release evidence.
