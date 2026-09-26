import { CHANGELOG_AREAS, CHANGELOG_ENTRY_TYPES, isChangelogEntryType } from "./types"
import type { ChangelogArea, ChangelogEntryType } from "./types"
import type { StatusVariant } from "@workspace/ui/components/status-badge"
import { formatDate as formatDateShared } from "@/shared/lib/format"

export const CHANGELOG_TYPES = CHANGELOG_ENTRY_TYPES
export { CHANGELOG_AREAS }

/** Areas hidden behind the "show internal changes" toggle by default (DX-010). */
export const INTERNAL_AREAS: Array<ChangelogArea> = ["ci", "internal"]

/** Areas offered in the filter while internal changes are hidden. */
export function publicAreas(): Array<ChangelogArea> {
  return CHANGELOG_AREAS.filter((area) => !INTERNAL_AREAS.includes(area))
}

export function typeToVariant(type: string): StatusVariant {
  const map: Record<ChangelogEntryType, StatusVariant> = {
    added: "success",
    changed: "info",
    fixed: "info-subtle",
    deprecated: "muted",
    removed: "danger-subtle",
    security: "warning",
  }

  return isChangelogEntryType(type) ? map[type] : "neutral"
}

export function typeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function areaLabel(area: string): string {
  const map: Record<string, string> = {
    trade: "Trading",
    pools: "Pools",
    earn: "Earn",
    referrals: "Referrals",
    faucet: "Faucet",
    wallet: "Wallet",
    docs: "Documentation",
    general: "General",
    ci: "CI",
    internal: "Internal",
  }
  return map[area] || area
}

// DX-072 shared helper, not an ad-hoc toLocaleDateString: the default en-US
// locale means every visitor sees the identical release-date format no matter
// what their browser requests.
export function formatDate(dateStr: string): string {
  return formatDateShared(dateStr)
}

export function createAnchor(version: string): string {
  return `#v${version.replace(/\./g, "-")}`
}
