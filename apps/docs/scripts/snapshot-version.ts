/**
 * DX-050: freeze the current `content/` tree into a versioned snapshot.
 *
 * Usage:
 *   bun run scripts/snapshot-version.ts <version-id>
 *
 * <version-id> must be lowercase kebab-case (e.g. `v1`). The snapshot is
 * written to `content-versions/<version-id>/`, an exact copy of `content/`
 * at the moment the command runs, including its own `meta.json`. That
 * directory is git-ignored — see docs/dx_1/001_docs_site.md and the
 * "Snapshot procedure" note in this file's usage above for why a snapshot is
 * reproduced by this script rather than committed: it is a frozen render of
 * `content/`, not new authored content, so committing it would duplicate
 * everything under `content/` for every version this repository ever ships.
 *
 * `build.ts` discovers every directory under `content-versions/` and
 * publishes each one under an explicit `/<version-id>` route prefix,
 * alongside the always-unprefixed current version.
 */

import { existsSync } from "node:fs"
import { cp, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { appRoot, contentRoot, versionsRoot } from "./content"

const id = process.argv[2]

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error(
    "Usage: bun run scripts/snapshot-version.ts <version-id>\n" +
      "<version-id> must be lowercase kebab-case, e.g. v1.",
  )
  process.exit(1)
}

const destination = join(versionsRoot, id)

if (existsSync(destination)) {
  console.error(
    `content-versions/${id} already exists. Remove it first if you intend to re-snapshot.`,
  )
  process.exit(1)
}

await mkdir(destination, { recursive: true })
await cp(contentRoot, destination, { recursive: true })

console.log(
  `Snapshotted ${join(appRoot, "content")} -> content-versions/${id}/. ` +
    `Run "bun run scripts/build.ts" to publish it under /${id}.`,
)
