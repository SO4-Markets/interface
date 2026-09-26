import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { RefreshIcon, RssIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@workspace/ui/components/icon"
import { EmptyState, ErrorState } from "@workspace/ui/components/states"
import { LiveRegion, useAnnouncer } from "@workspace/ui/components/live-region"
import { entryMatchesFilters } from "../search"
import { validateChangelogData } from "../validate"
import { loadArchiveOnce } from "../archive"
import { writeSeenVersion } from "../whats-new"
import { FilterBar } from "./FilterBar"
import { ReleaseSection } from "./ReleaseSection"
import { ChangelogSkeleton } from "./ChangelogSkeleton"
import type { ChangelogData, ChangelogSearch, Release } from "../types"

type ArchiveStatus = "idle" | "loading" | "loaded" | "error"

function anchorIdFromHash(): string | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash
  return hash.length > 1 ? decodeURIComponent(hash.slice(1)) : null
}

function versionToAnchorId(version: string): string {
  return `v${version.replace(/\./g, "-")}`
}

export function ChangelogPage() {
  const search = useSearch({ from: "/changelog" })
  const navigate = useNavigate({ from: "/changelog" })
  const [data, setData] = useState<ChangelogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // DX-012: archive releases, fetched at most once per session.
  const [archiveReleases, setArchiveReleases] = useState<Array<Release>>([])
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("idle")

  const fetchChangelog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/changelog.json")
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load changelog`)
      }
      const json: unknown = await res.json()
      if (!validateChangelogData(json)) {
        throw new Error("Invalid changelog format: missing or malformed releases")
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const { message, announcementKey, announce } = useAnnouncer()

  const activeFilterCount = [
    search.type,
    search.area,
    search.q,
    search.showInternal,
  ].filter(Boolean).length

  const isFiltered = activeFilterCount > 0

  const handleFilterChange = useCallback(
    (next: Partial<ChangelogSearch>) => {
      void navigate({
        search: (prev) => {
          const updated: ChangelogSearch = { ...prev, ...next }
          const clean: ChangelogSearch = {}
          if (updated.type) clean.type = updated.type
          if (updated.area) clean.area = updated.area
          if (updated.q) clean.q = updated.q
          if (updated.showInternal) clean.showInternal = updated.showInternal
          return clean
        },
      })
    },
    [navigate]
  )

  useEffect(() => {
    void fetchChangelog()
  }, [fetchChangelog])

  // DX-012: a filtered view that silently omits history is wrong — pull the
  // archive in automatically whenever any filter or search is active.
  const ensureArchive = useCallback(() => {
    if (archiveStatus === "loading" || archiveStatus === "loaded") return
    setArchiveStatus("loading")
    loadArchiveOnce()
      .then((releases) => {
        setArchiveReleases(releases)
        setArchiveStatus("loaded")
      })
      .catch(() => {
        setArchiveStatus("error")
      })
  }, [archiveStatus])

  useEffect(() => {
    if (data && isFiltered && archiveStatus !== "loaded") {
      ensureArchive()
    }
  }, [data, isFiltered, archiveStatus, ensureArchive])

  // DX-016: visiting /changelog acknowledges the newest release, clearing the
  // navbar dot. Storage failures are swallowed inside the writer.
  const newestVersion = data?.releases[0]?.version
  useEffect(() => {
    if (newestVersion) writeSeenVersion(newestVersion)
  }, [newestVersion])

  // All releases, recent window first and archive appended once loaded.
  const allReleases = useMemo(
    () => (archiveReleases.length ? [...(data?.releases ?? []), ...archiveReleases] : data?.releases ?? []),
    [data, archiveReleases]
  )

  const filteredReleases = useMemo(
    () =>
      allReleases
        .map((release) => ({
          ...release,
          entries: release.entries.filter((entry) =>
            entryMatchesFilters(entry, search)
          ),
        }))
        .filter((release) => release.entries.length > 0),
    [allReleases, search]
  )

  // DX-012: deep links to an archived anchor load the archive first, then
  // scroll once the element exists in the DOM. The hash is captured once, on
  // cold load, so in-page navigation never re-triggers this.
  const [pendingAnchorId] = useState(() => anchorIdFromHash())
  const anchorHandledRef = useRef(false)

  useEffect(() => {
    if (!pendingAnchorId || loading || !data || anchorHandledRef.current) return

    const knownAnchorIds = new Set(
      allReleases.map((release) => versionToAnchorId(release.version))
    )
    if (knownAnchorIds.has(pendingAnchorId)) {
      anchorHandledRef.current = true
      requestAnimationFrame(() => {
        document.getElementById(pendingAnchorId)?.scrollIntoView({ block: "start" })
      })
      return
    }
    // Anchor not rendered yet: it may live in the archive.
    if (data.hasArchive && archiveStatus !== "loaded") ensureArchive()
  }, [pendingAnchorId, loading, data, allReleases, archiveStatus, ensureArchive])

  // Announce filter results with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      const resultCount = filteredReleases.reduce(
        (sum, release) => sum + release.entries.length,
        0
      )
      announce(`${resultCount} result${resultCount !== 1 ? "s" : ""} found`)
    }, 300)
    return () => clearTimeout(timer)
  }, [announce, filteredReleases])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border px-[var(--gutter-page-sm)] pt-6 pb-4 md:px-[var(--gutter-page-md)] md:pt-8 md:pb-6 lg:px-[var(--gutter-page-lg)] lg:pt-10">
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            <div className="h-10 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-96 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-[var(--gutter-page-sm)] py-6 md:px-[var(--gutter-page-md)] md:py-8 lg:px-[var(--gutter-page-lg)]">
          <ChangelogSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border px-[var(--gutter-page-sm)] pt-6 pb-4 md:px-[var(--gutter-page-md)] md:pt-8 md:pb-6 lg:px-[var(--gutter-page-lg)] lg:pt-10">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-2 text-display-sm font-bold text-foreground md:text-display">
              Changelog
            </h1>
            <p className="text-body text-text-secondary">
              Everything that shipped, newest first.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-[var(--gutter-page-sm)] py-6 md:px-[var(--gutter-page-md)] md:py-8 lg:px-[var(--gutter-page-lg)]">
          <ErrorState
            title="Failed to load changelog"
            description={error}
            onRetry={fetchChangelog}
            retryLabel="Try again"
          />
        </div>
      </div>
    )
  }

  if (!data || data.releases.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border px-[var(--gutter-page-sm)] pt-6 pb-4 md:px-[var(--gutter-page-md)] md:pt-8 md:pb-6 lg:px-[var(--gutter-page-lg)] lg:pt-10">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-2 text-display-sm font-bold text-foreground md:text-display">
              Changelog
            </h1>
            <p className="text-body text-text-secondary">
              Everything that shipped, newest first.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-[var(--gutter-page-sm)] py-6 md:px-[var(--gutter-page-md)] md:py-8 lg:px-[var(--gutter-page-lg)]">
          <EmptyState
            title="No releases yet"
            description="The changelog is empty. Releases will appear here as they ship."
          />
        </div>
      </div>
    )
  }

  const showLoadOlder = Boolean(data.hasArchive) && archiveStatus !== "loaded"

  return (
    <div className="min-h-screen bg-background">
      {/* Page header with safe area padding */}
      <div className="px-[var(--gutter-page-sm)] md:px-[var(--gutter-page-md)] lg:px-[var(--gutter-page-lg)] pt-6 md:pt-8 lg:pt-10 pb-4 md:pb-6 border-b border-border">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-display-sm md:text-display font-bold text-foreground mb-2 break-words">
              Changelog
            </h1>
            <p className="text-body text-text-secondary">
              Everything that shipped, newest first.
            </p>
          </div>
          <a
            href="/feed.json"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs/relaxed font-medium transition-colors hover:bg-muted"
          >
            <Icon icon={RssIcon} />
            <span>Feed</span>
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="px-[var(--gutter-page-sm)] md:px-[var(--gutter-page-md)] lg:px-[var(--gutter-page-lg)] py-6 md:py-8 max-w-4xl mx-auto">
        {/* Live region for filter announcements */}
        <LiveRegion message={message} announcementKey={announcementKey} />

        {/* Filter region - landmark */}
        <section aria-labelledby="filter-heading" className="mb-6">
          <h2 id="filter-heading" className="sr-only">
            Filters and search
          </h2>
          <FilterBar
            search={search}
            onFilterChange={handleFilterChange}
            activeFilterCount={activeFilterCount}
          />
        </section>

        {/* Releases list */}
        {filteredReleases.length > 0 ? (
          <section aria-label="Release history" className="space-y-0">
            <ul role="list" className="space-y-0">
              {filteredReleases.map((release) => (
                <li key={release.version}>
                  <ReleaseSection
                    release={release}
                    isFiltered={isFiltered}
                    highlight={search.q}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="py-12 text-center">
            <p className="text-body text-text-secondary mb-2">
              No entries match your filters.
            </p>
            <Button
              variant="link"
              onClick={() => handleFilterChange({})}
              className="h-9 px-3"
            >
              Clear all filters
            </Button>
          </div>
        )}

        {/* Load older releases (DX-012) */}
        {showLoadOlder && (
          <div className="mt-10 flex justify-center pb-4">
            <Button
              variant="outline"
              size="lg"
              className="h-11 min-w-56"
              disabled={archiveStatus === "loading"}
              aria-busy={archiveStatus === "loading"}
              onClick={ensureArchive}
            >
              <span className="flex items-center gap-2">
                {archiveStatus === "loading" ? (
                  <>
                    <Icon icon={RefreshIcon} className="animate-spin" />
                    Loading older releases…
                  </>
                ) : (
                  "Load older releases"
                )}
              </span>
            </Button>
          </div>
        )}
        {archiveStatus === "error" && (
          <div role="alert" className="mt-6 text-center">
            <p className="text-body-sm text-text-secondary mb-2">
              Couldn&apos;t load older releases.
            </p>
            <Button variant="link" onClick={ensureArchive} className="h-9 px-3">
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
