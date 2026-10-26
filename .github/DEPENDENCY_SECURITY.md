# Dependency update and vulnerability audit policy

The root `bun.lock` is the source of truth for resolved dependencies. GitHub
Dependabot checks Bun workspaces weekly and groups compatible production
and development updates separately. GitHub Actions updates are tracked
in a separate weekly group.

The **Dependency audit (high and critical)** CI job runs
`bun audit --audit-level=high` on the committed Bun lockfile. A high- or
critical-severity finding fails the job; an unavailable or malformed npm
advisory response also fails closed. This deliberately does not use
`--prod`, since development and build tools can expose contributors
and CI systems to attack.

## When an advisory is reported

1. Open the advisory (GHSA ID) and identify the installed package, dependency
   path, affected versions, available patched release, and reachable impact.
2. Prefer a compatible direct dependency update; otherwise propose an
   appropriate transitive upgrade or reviewed override. Update `bun.lock`
   with Bun and validate `bun install --frozen-lockfile` in a clean checkout.
3. Run the repository's full commit gate, plus the relevant web/indexer
   integration checks described in `AGENTS.md`. Do not disable tests or lower
   audit thresholds to make the change appear successful.
4. If no published fix exists, document the risk in a tracked issue and
   propose a mitigation or replacement. A temporary ignore requires explicit
   maintainer security review.

## Narrowly-scoped exceptions

A temporary exception must identify:

- **GHSA ID** (use GHSA or numeric npm advisory IDs, not CVE IDs for Bun's
  `--ignore` flag)
- affected package and exact installed version
- whether the vulnerable code can be reached in production, development or CI
- why an update, override, isolation or replacement is not currently possible
- compensating controls and the issue tracking a permanent fix
- maintainer approval, approval date and a removal/review deadline

Only after approval may the CI command add the specific
`--ignore GHSA-xxxx-yyyy-zzzz` option. Never ignore a whole severity class
or an unaudited vulnerability just to turn CI green. Keep each approved
exception documented beside the audit command and in the tracking issue.

**Review every exception at least quarterly**, and immediately when a fix
is released, the affected dependency changes or an incident changes its
impact. Remove ignores as soon as they are no longer justified.

No exceptions are pre-approved by this document. Current audit failures
must be investigated, not automatically bypassed.

## Observed baseline: October 18, 2026

The first implementation run of `bun audit --audit-level=high` reported
three **high** advisories in the unmodified upstream lockfile:

| Advisory | Resolved dependency path | Status on review date |
| --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `@workspace/ui` → `shadcn` → `braces` | No patched published version |
| [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) | `docs` → `@lhci/cli` → `extract-zip` | No patched published version |
| [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | `docs` → `@lhci/cli` → `extract-zip` | No patched published version |

These are **unresolved**; the audit job intentionally fails until an
effective dependency replacement/remediation ships or maintainers approve
time-bound, reachability-reviewed exceptions using the process above.
A detected vulnerability is not evidence that this product's code path is
exploitable. Before an exception, assess whether untrusted brace patterns
or untrusted ZIP files can reach the cited tools in production or CI.
The next quarterly checkpoint is **January 18, 2027**, or sooner when
patches become available.

## Approved exceptions

| GHSA | Package (installed) | Reachable in | Why not fixable now | Compensating controls | Approved | Review by |
| --- | --- | --- | --- | --- | --- | --- |
| GHSA-jmr9-qjv8-65gv | extract-zip 2.0.1 | CI only (`docs` → `@lhci/cli` → puppeteer) | No patched release; parent pins it | Only extracts Chromium from Google's CDN in CI; not in any shipped bundle | @IbrahimIjai, 2026-10-26 | 2027-01-18 |
| GHSA-7pqw-9j4j-h8q3 | extract-zip 2.0.1 | same as above | same as above | same as above | @IbrahimIjai, 2026-10-26 | 2027-01-18 |
| GHSA-mrhx-c7xc-m3w5 | zod 3.22.4 / 3.23.8 / 3.25.76 | web runtime (`@pythnetwork/hermes-client`, `@reown/appkit-wallet`), build tooling | Latest releases of both parents still require zod 3 | Inputs are trusted API responses; Hermes is reached via `/api/pyth`, which only forwards the app's fixed feed IDs; any DoS is confined to the user's own tab | @IbrahimIjai, 2026-10-26 | 2027-01-18 |

Tracking issue: [#1035](https://github.com/SO4-Markets/interface/issues/1035). Remove each
`--ignore` from `.github/workflows/ci.yml` as soon as its exit criterion is met.
The braces advisory (GHSA-vfj7-8cjw-p6xm) from the October 18 baseline no longer
appears in the lockfile.
