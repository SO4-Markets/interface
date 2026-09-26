import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { verifyReleaseTag, isWithinOneDay, extractReleaseNotes } from "./verify-tag.ts"

describe("DX-025: verifyReleaseTag", () => {
  let tempDir: string
  let changelogPath: string
  let unreleasedDir: string

  const sampleChangelog = `
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.2.0] - 2026-08-30

### Added

- Added support for new perpetual markets. ([#540](https://github.com/SO4-Markets/interface/pull/540)) <!-- so4: area=trade -->

### Fixed

- Fixed chart theme flickering on page load. ([#542](https://github.com/SO4-Markets/interface/pull/542)) <!-- so4: area=trade -->

## [0.1.0] - 2026-08-20

### Added

- Initial testnet release. ([#1](https://github.com/SO4-Markets/interface/pull/1)) <!-- so4: area=general -->

[Unreleased]: https://github.com/SO4-Markets/interface/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/SO4-Markets/interface/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SO4-Markets/interface/releases/tag/v0.1.0
`

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "changelog-verify-test-"))
    changelogPath = join(tempDir, "CHANGELOG.md")
    unreleasedDir = join(tempDir, ".changelog", "unreleased")
    await mkdir(unreleasedDir, { recursive: true })
    await writeFile(changelogPath, sampleChangelog, "utf-8")
    // Keep README in unreleased directory
    await writeFile(join(unreleasedDir, "README.md"), "# Unreleased changes\n", "utf-8")
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test("passes when tag matches current section in CHANGELOG and unreleased is empty", async () => {
    const result = await verifyReleaseTag({
      tag: "v0.2.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
    })

    expect(result.valid).toBe(true)
    expect(result.version).toBe("0.2.0")
    expect(result.date).toBe("2026-08-30")
    expect(result.notes).toContain("### Added")
    expect(result.notes).toContain("Added support for new perpetual markets.")
    expect(result.errors).toHaveLength(0)
  })

  test("extracts clean release notes for the specific version", () => {
    const notes = extractReleaseNotes(sampleChangelog, "0.2.0")
    expect(notes).not.toBeNull()
    expect(notes).toContain("### Added")
    expect(notes).toContain("Added support for new perpetual markets.")
    expect(notes).not.toContain("## [0.1.0]")
    expect(notes).not.toContain("Initial testnet release")
    expect(notes).not.toContain("[0.2.0]:")
  })

  test("fails with descriptive error when tag does not start with 'v'", async () => {
    const result = await verifyReleaseTag({
      tag: "0.2.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('must start with "v"'))).toBe(true)
  })

  test("fails with descriptive error when tag is not valid semver", async () => {
    const result = await verifyReleaseTag({
      tag: "v0.2",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes("Must be valid SemVer"))).toBe(true)
  })

  test("fails when .changelog/unreleased/ has unconsumed entries", async () => {
    await writeFile(
      join(unreleasedDir, "001-test-feature.md"),
      "---\ntype: added\narea: trade\npr: 550\nbreaking: false\n---\nAdded test feature.\n",
      "utf-8"
    )

    const result = await verifyReleaseTag({
      tag: "v0.2.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.includes(".changelog/unreleased/ is not empty"))
    ).toBe(true)
    expect(
      result.errors.some((e) => e.includes("001-test-feature.md"))
    ).toBe(true)
  })

  test("fails when CHANGELOG.md lacks a section for the tag", async () => {
    const result = await verifyReleaseTag({
      tag: "v0.3.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) =>
        e.includes('does not contain a release section for version "0.3.0"')
      )
    ).toBe(true)
  })

  test("fails when release date in CHANGELOG is stale (> 1 day old)", async () => {
    const result = await verifyReleaseTag({
      tag: "v0.2.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-09-05", // 6 days later
    })

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("is not within 1 day of tag date"))
    ).toBe(true)
  })

  test("isWithinOneDay date helper accurately compares dates within 24h window", () => {
    expect(isWithinOneDay("2026-08-30", "2026-08-30")).toBe(true)
    expect(isWithinOneDay("2026-08-30", "2026-08-31")).toBe(true)
    expect(isWithinOneDay("2026-08-31", "2026-08-30")).toBe(true)
    expect(isWithinOneDay("2026-08-30", "2026-09-02")).toBe(false)
    expect(isWithinOneDay("invalid", "2026-08-30")).toBe(false)
  })

  test("writes extracted notes to outputNotesPath when specified", async () => {
    const notesFile = join(tempDir, "extracted-notes.md")
    const result = await verifyReleaseTag({
      tag: "v0.2.0",
      changelogPath,
      unreleasedDir,
      currentDate: "2026-08-30",
      outputNotesPath: notesFile,
    })

    expect(result.valid).toBe(true)
    const written = await Bun.file(notesFile).text()
    expect(written).toContain("Added support for new perpetual markets.")
  })
})
