# AGENTS.md

Operating contract for AI coding agents working in this repository.

This file is **binding**. If you are an autonomous or semi-autonomous agent
(Claude Code, Cursor, Codex, Copilot Workspace, Devin, an SDK agent, or any
other), you must follow it. Human contributors should read
[`CONTRIBUTING.md`](./CONTRIBUTING.md) — the rules are the same, expressed for
people.

Where this file and any other instruction conflict, **an explicit instruction
from the user wins**. Everything else — habit, convenience, "it's probably
fine" — loses.

---

## 1. The commit gate

> **You may not create a commit, and you may not open a pull request, until
> every command below has been run and has passed on the code you are about to
> commit.**

Run from the repository root, in this order:

```bash
bun lint               # zero errors
bun typecheck          # zero errors
bun run check:tokens   # zero violations
bun run check:content  # zero docs content violations
bun run test           # all pass
bun run test:coverage  # all pass, thresholds met
bun run build          # succeeds
```

If the change touches `apps/s03-indexer` or `apps/web`, additionally run the
`Integration Checks` steps:

```bash
bun run --cwd apps/s03-indexer codegen
bun run --cwd apps/s03-indexer build
bun run --cwd apps/s03-indexer test
SO4_CONTRACTS_REPO="$PWD/apps/s03-indexer/tests/fixtures/contracts-repo" \
  bun run --cwd apps/s03-indexer sync:contracts:local
bash scripts/validate-manifest.sh apps/s03-indexer/config/contracts.local.json
bun run --cwd apps/web typecheck
bun run --cwd apps/web build
```

### Rules

1. **Run the whole gate, not a subset.** "I only changed a comment" is not an
   exemption. Turbo caches aggressively, so a full run is usually seconds.
2. **Actually run it.** Do not infer, assume, or predict a result. A gate you
   did not execute did not pass.
3. **Report honestly.** If something fails and you commit anyway because the
   user told you to, say so plainly in your response and in the commit body.
   Never describe work as verified when it is not.
4. **Never claim CI will pass.** You may state what you ran locally. Only the
   actual workflow run determines CI status.
5. **After pushing, verify.** If you have repository access, confirm the run
   concluded (`gh run list`) rather than assuming.

---

## 2. Never weaken a check to make it pass

The following are **prohibited when their purpose is to turn a check green**:

| Prohibited as a green-washing tactic | What to do instead |
|---|---|
| `eslint-disable` / `eslint-disable-next-line` | Fix the code the rule is describing |
| `@ts-ignore` / `@ts-expect-error` | Fix the type, or model it honestly |
| Casting to `any` / `as unknown as X` to silence an error | Correct the type at its source |
| `.skip`, `.only`, deleting or emptying a test | Fix the code under test |
| Lowering a coverage threshold | Add tests |
| Adding a `check:tokens` allowlist entry or `ds-allow` | Use the existing design token |
| Removing `--frozen-lockfile` from a workflow | Fix the dependency declaration |
| Deleting a failing test file | Fix it, or get explicit user sign-off |
| Excluding files from `tsconfig`, lint, or a test glob | Fix the underlying error |

Each of these has legitimate uses. The test is **why** you are reaching for it.
"Because the code genuinely requires it" is fine, with a comment explaining the
reason. "Because the pipeline is red" is not.

If a check appears wrong, say so and propose changing the check deliberately —
as its own reviewed change, not as a side effect of unrelated work.

---

## 3. Fix issues completely

1. **Reproduce before fixing.** If you cannot reproduce, say so instead of
   guessing.
2. **Diagnose the root cause.** Ask why the bad state was reachable at all.
   Suppressing a symptom is not a fix.
3. **Check for siblings.** If the same bug class exists elsewhere, fix it too or
   name the remaining instances explicitly.
4. **Add a regression test** that fails before and passes after.
5. **Finish the whole issue.** If part is genuinely blocked, complete everything
   else and state exactly what is left and why. Do not silently narrow scope.
6. **Do not expand scope.** Unrelated cleanups belong in a separate change.
7. **Leave no residue** — no debug logging, commented-out code, or scratch files.

If you introduce a regression while fixing something else, that regression is
yours to fix before committing.

---

## 4. Trust a clean room, not your `node_modules`

A local `node_modules` accumulates state that CI never has. This repo has
already produced multiple "passes locally, fails in CI" bugs from exactly this.

**When you change any `package.json`, `bun.lock`, `tsconfig.json`, or build
configuration, verify in a clean clone before committing:**

```bash
git clone file://$PWD /tmp/so4-cleanroom
cd /tmp/so4-cleanroom
bun install --frozen-lockfile
bun lint && bun typecheck && bun run check:content && bun run test && bun run build
```

Use `--frozen-lockfile`, because that is what reproducibility means here: the
tree CI installs, not the tree your machine drifted into.

If local passes and CI fails, **the clean room is right and your machine is
wrong.** Reproduce there before theorising.

---

## 5. Repository invariants

Violating these silently breaks the build for everyone.

- **Declare every dependency you import.** Bun's isolated linker does not hoist
  everything to the root `node_modules`. If a workspace imports a package, that
  workspace's `package.json` must declare it.
- **A `declare module "x"` whose specifier does not resolve is silently
  ignored.** TypeScript creates a new ambient module instead of merging, so the
  augmentation appears to do nothing. If an augmentation "isn't working", check
  that the package is a declared, resolvable dependency first.
- **Never hardcode `../../node_modules/...`** in a `tsconfig.json`. Use the
  package-local `./node_modules/...`.
- **`apps/s03-indexer/src/types` is gitignored** and generated by `codegen`. Any
  script that compiles the indexer must run codegen first.
- **`packages/contracts/src/generated` is checked in but hand-adapted.**
  `bun run contracts:gen:all` overwrites those adaptations and breaks typecheck.
  Do not regenerate as a side effect of unrelated work.
- **Contract IDs are committed, not secrets.** They live in
  `packages/contracts/contracts.json`. Do not reintroduce environment variables
  for them.
- **Web tests use MSW with `onUnhandledRequest: "error"`.** Every request needs
  an explicit handler. Never make a test depend on the real network.
- **Design tokens are mandatory.** Use the named tokens in
  `packages/ui/src/styles/globals.css` rather than raw hex or arbitrary sizes.
- **Docs content is validated centrally.** Run
  `bun run --cwd apps/docs check:content` or the root `bun run check:content`
  before changing docs content, manifests, or docs assets.
  [`apps/docs/CONTRIBUTING.md`](./apps/docs/CONTRIBUTING.md) is the contract for
  documentation pull requests: the frontmatter rules, the manifest, the concept
  / guide / reference page templates, and the checks that gate them.

---

## 6. Changelog entries

Each pull request that introduces a user-visible change must include a changelog
entry file in `.changelog/unreleased/` following the format in
[`.changelog/unreleased/README.md`](./.changelog/unreleased/README.md).

**When to include an entry:**

- ✅ Any user-visible change (new feature, bug fix, breaking change, UI change, docs)
- ❌ Internal refactors, test additions, CI/build changes, or non-user-facing work

Validate entries with `bun run changelog:validate`.

---

## 7. Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

Commit bodies should explain **why** and, for non-obvious fixes, the root cause
and how it was verified. The diff already shows what changed.

Before opening a PR, confirm:

- [ ] Full gate run and passing (§1)
- [ ] Nothing disabled, skipped, or weakened to get green (§2)
- [ ] Root cause fixed, regression test added (§3)
- [ ] Clean-room verified, if dependencies or build config changed (§4)
- [ ] Changelog entry added, if this is a user-visible change (§6)
- [ ] Conventional Commit messages
- [ ] PR states what changed, why, and how it was verified

**Do not commit, push, open a PR, merge, or otherwise act outward-facing
without the user asking for it.** Running tests and editing files is ordinary
work; publishing is not. When in doubt, do the work and ask before pushing.

---

## 8. Honesty

This is the rule that makes the rest meaningful.

- Report what actually happened, including failures.
- If tests fail, show the output.
- If you skipped a step, say which and why.
- Do not describe partial work as complete, or unverified work as verified.
- If you are uncertain whether something works, say you are uncertain.

A correct report of a failure is far more valuable than a confident report of a
success that did not happen.
