export const CHANGELOG_ENTRY_TYPES = [
  "added",
  "changed",
  "deprecated",
  "removed",
  "fixed",
  "security",
] as const

export const CHANGELOG_AREAS = [
  "trade",
  "pools",
  "earn",
  "referrals",
  "faucet",
  "wallet",
  "docs",
  "general",
  "ci",
  "internal",
] as const

export type ChangelogEntryType = (typeof CHANGELOG_ENTRY_TYPES)[number]
export type ChangelogArea = (typeof CHANGELOG_AREAS)[number]

export function isChangelogEntryType(val: unknown): val is ChangelogEntryType {
  return (
    typeof val === "string" &&
    (CHANGELOG_ENTRY_TYPES as ReadonlyArray<string>).includes(val)
  )
}

export function isChangelogArea(val: unknown): val is ChangelogArea {
  return (
    typeof val === "string" &&
    (CHANGELOG_AREAS as ReadonlyArray<string>).includes(val)
  )
}

export interface ChangelogEntry {
  type: ChangelogEntryType
  // Pre-tooling and hand-written historical entries have no area; the parser
  // (scripts/changelog/parse.ts) emits null for them.
  area: ChangelogArea | null
  text: string
  pr: number | null
  breaking: boolean
}

export interface Release {
  version: string
  date: string
  yanked: boolean
  entries: Array<ChangelogEntry>
}

export interface ChangelogData {
  releases: Array<Release>
  /** True when older releases live in /changelog.archive.json (DX-012). */
  hasArchive?: boolean
}

export type ChangelogSearch = {
  type?: ChangelogEntryType
  area?: ChangelogArea
  q?: string
  /** Show ci/internal entries; URL-backed so the view stays shareable (DX-010). */
  showInternal?: boolean
}