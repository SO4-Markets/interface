import { useState } from "react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Divider } from "@workspace/ui/components/separator"
import { Icon } from "@workspace/ui/components/icon"
import { createAnchor, formatDate } from "../utils"
import { ChangelogEntry } from "./ChangelogEntry"
import type { Release } from "../types"

interface ReleaseSectionProps {
  release: Release
  isFiltered: boolean
  highlight?: string
}

export function ReleaseSection({
  release,
  isFiltered,
  highlight,
}: ReleaseSectionProps) {
  const [copied, setCopied] = useState(false)
  const anchor = createAnchor(release.version)

  const handleCopyPermalink = async () => {
    const origin =
      typeof window === "undefined"
        ? "https://so4.market"
        : window.location.origin
    const permalink = `${origin}/changelog${anchor}`
    try {
      await navigator.clipboard.writeText(permalink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    // Yanked releases keep their permanent anchor but render muted — the
    // YANKED badge stays at full emphasis so withdrawal is unmistakable.
    <section
      id={anchor.slice(1)}
      aria-label={`Version ${release.version}${release.yanked ? " (yanked)" : ""}`}
      className={
        release.yanked
          ? "mb-8 sm:mb-12 pb-8 sm:pb-12 opacity-60 last:mb-0 last:pb-0"
          : "mb-8 sm:mb-12 pb-8 sm:pb-12 last:border-b-0 last:mb-0 last:pb-0 border-b border-border"
      }
    >
      {/* Release header: responsive layout */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:gap-4">
        {/* Version and date: stack on mobile, inline on desktop */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* h2 for release - proper heading hierarchy */}
              <h2 className="text-page-title font-bold text-foreground break-words">
                {release.version}
              </h2>
              {release.yanked && (
                <Badge variant="danger" size="sm">
                  YANKED
                </Badge>
              )}
            </div>
            <p className="text-body-sm text-text-secondary">
              {/* Shared DS-072 locale helper — identical format for everyone. */}
              <time dateTime={release.date}>{formatDate(release.date)}</time>
            </p>
          </div>

          {/* Permalink button: 44×44 touch target, keyboard accessible */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPermalink}
            className="h-11 w-11 p-0 flex-shrink-0 justify-center items-center focus-visible:ring-2"
            title={`Copy permalink for version ${release.version}`}
            aria-label={`Copy permalink for version ${release.version}`}
          >
            <Icon
              icon={copied ? Tick02Icon : Copy01Icon}
              tone={copied ? "success" : "default"}
            />
          </Button>
        </div>

        {/* Version separator (DS-080) */}
        <Divider tone="default" />
      </div>

      {/* Entries list */}
      <ul role="list" className="space-y-1">
        {release.entries.map((entry, idx) => (
          <li key={idx}>
            <ChangelogEntry entry={entry} highlight={highlight} />
          </li>
        ))}
      </ul>

      {isFiltered && (
        <p className="mt-4 text-caption text-text-tertiary">
          Filtered view — some entries hidden
        </p>
      )}
    </section>
  )
}