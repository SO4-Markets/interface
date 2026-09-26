/**
 * DX-025: Tag & Changelog verification for CI release workflows.
 *
 * Verifies that when a release tag (v*) is pushed:
 * 1. .changelog/unreleased/ has no pending entries (all consumed).
 * 2. CHANGELOG.md contains a release section matching the version in the tag.
 * 3. The release date in CHANGELOG.md is within 1 day of the tag date.
 * 4. Extracts the clean markdown release notes for publishing GitHub Releases.
 *
 * Usage:
 *   bun run scripts/changelog/verify-tag.ts --tag v0.2.0 [--output-notes /tmp/notes.md]
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseChangelog } from "./parse.ts"

export interface VerifyTagOptions {
  tag: string
  changelogPath?: string
  unreleasedDir?: string
  currentDate?: string // YYYY-MM-DD for testing
  outputNotesPath?: string
}

export interface VerifyTagResult {
  valid: boolean
  version: string
  date: string
  notes: string
  errors: string[]
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function extractReleaseNotes(changelogContent: string, version: string): string | null {
  const lines = changelogContent.split("\n")
  const headingRegex = /^## \[([^\]]+)\]/
  let startIndex = -1
  let endIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex)
    if (match) {
      if (match[1] === version) {
        startIndex = i + 1
      } else if (startIndex !== -1) {
        endIndex = i
        break
      }
    } else if (startIndex !== -1 && lines[i].match(/^\[[^\]]+\]: /)) {
      endIndex = i
      break
    }
  }

  if (startIndex === -1) return null
  if (endIndex === -1) endIndex = lines.length

  const rawSection = lines.slice(startIndex, endIndex).join("\n").trim()
  return rawSection
}

export function isWithinOneDay(date1Str: string, date2Str: string): boolean {
  const d1 = new Date(`${date1Str}T00:00:00Z`).getTime()
  const d2 = new Date(`${date2Str}T00:00:00Z`).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return false
  return Math.abs(d1 - d2) <= ONE_DAY_MS
}

export async function verifyReleaseTag(options: VerifyTagOptions): Promise<VerifyTagResult> {
  const repoRoot = resolve(import.meta.dir, "../..")
  const changelogPath = options.changelogPath ?? join(repoRoot, "CHANGELOG.md")
  const unreleasedDir = options.unreleasedDir ?? join(repoRoot, ".changelog", "unreleased")
  const errors: string[] = []

  // 1. Validate tag format
  const tag = options.tag.trim()
  if (!tag.startsWith("v")) {
    errors.push(
      `✗ Invalid release tag "${tag}". Release tags must start with "v" (e.g., v1.0.0).`
    )
    return { valid: false, version: "", date: "", notes: "", errors }
  }

  const version = tag.slice(1)
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
    errors.push(
      `✗ Invalid version "${version}" in tag "${tag}". Must be valid SemVer (e.g., v0.2.0).`
    )
    return { valid: false, version, date: "", notes: "", errors }
  }

  // 2. Check unreleased directory is empty
  if (existsSync(unreleasedDir)) {
    try {
      const files = await readdir(unreleasedDir)
      const pendingFiles = files.filter(
        (f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md"
      )
      if (pendingFiles.length > 0) {
        errors.push(
          `✗ Assertion failed: .changelog/unreleased/ is not empty (found ${pendingFiles.length} pending entry file(s): ${pendingFiles.join(", ")}).\n` +
            `  Fix: Run 'bun run changelog:release ${version}' in a PR branch to consume pending entries before tagging.`
        )
      }
    } catch (err) {
      errors.push(`✗ Failed to read unreleased directory "${unreleasedDir}": ${err}`)
    }
  }

  // 3. Read and parse CHANGELOG.md
  let changelogContent = ""
  try {
    changelogContent = await readFile(changelogPath, "utf-8")
  } catch (err) {
    errors.push(`✗ Could not read CHANGELOG.md at "${changelogPath}": ${err}`)
    return { valid: false, version, date: "", notes: "", errors }
  }

  let changelogData
  try {
    changelogData = parseChangelog(changelogContent)
  } catch (err) {
    errors.push(`✗ Failed to parse CHANGELOG.md: ${err}`)
    return { valid: false, version, date: "", notes: "", errors }
  }

  const release = changelogData.releases.find((r) => r.version === version)
  if (!release) {
    errors.push(
      `✗ Assertion failed: CHANGELOG.md does not contain a release section for version "${version}".\n` +
        `  Fix: Run 'bun run changelog:release ${version}' and merge the resulting PR to main before tagging.`
    )
    return { valid: false, version, date: "", notes: "", errors }
  }

  // 4. Verify release date freshness (within 1 day)
  const targetDate =
    options.currentDate ?? new Date().toISOString().slice(0, 10)
  if (!isWithinOneDay(release.date, targetDate)) {
    errors.push(
      `✗ Assertion failed: Release date in CHANGELOG.md (${release.date}) is not within 1 day of tag date (${targetDate}).\n` +
        `  Fix: Update the release date in CHANGELOG.md for [${version}] to ${targetDate} in a PR before tagging.`
    )
  }

  // 5. Extract release notes body
  const notes = extractReleaseNotes(changelogContent, version) ?? ""

  if (options.outputNotesPath && errors.length === 0) {
    await writeFile(options.outputNotesPath, notes, "utf-8")
  }

  return {
    valid: errors.length === 0,
    version,
    date: release.date,
    notes,
    errors,
  }
}

async function main() {
  const args = process.argv.slice(2)
  let tag = process.env.GITHUB_REF_NAME ?? ""
  let outputNotesPath: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tag" && args[i + 1]) {
      tag = args[++i]
    } else if (args[i] === "--output-notes" && args[i + 1]) {
      outputNotesPath = args[++i]
    } else if (!args[i].startsWith("--") && !tag) {
      tag = args[i]
    }
  }

  if (!tag) {
    console.error("Usage: bun run scripts/changelog/verify-tag.ts --tag <tag> [--output-notes <path>]")
    process.exit(1)
  }

  console.log(`Verifying release tag "${tag}"...`)
  const result = await verifyReleaseTag({ tag, outputNotesPath })

  if (!result.valid) {
    console.error("\nRelease verification failed:")
    for (const error of result.errors) {
      console.error(`\n${error}`)
    }
    process.exit(1)
  }

  console.log(`✓ Release tag ${tag} matches CHANGELOG.md section [${result.version}] (${result.date})`)
  console.log(`✓ .changelog/unreleased/ is empty`)
  console.log(`✓ Release date is current (${result.date})`)
  if (outputNotesPath) {
    console.log(`✓ Extracted release notes written to ${outputNotesPath}`)
  }
}

const invokedDirectly = process.argv[1]?.endsWith("verify-tag.ts")
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
