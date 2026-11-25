import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useChangelog } from "../hooks/use-changelog"
import {
  hasUnseenFeatureRelease,
  markReleaseSeen,
  readSeenRelease,
} from "../lib/seen-release"
import { CHANGELOG_ENTRY_TYPES } from "../types"
import { formatDate, typeLabel } from "../utils"
import { ChangelogEntry } from "./ChangelogEntry"

export function WhatsNew({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const changelog = useChangelog()
  const newestRelease = changelog.data?.releases[0]
  const seenVersion =
    typeof window === "undefined" ? null : readSeenRelease(window.localStorage)
  const showIndicator = newestRelease
    ? hasUnseenFeatureRelease(newestRelease.version, seenVersion)
    : false

  const groupedEntries = useMemo(
    () =>
      CHANGELOG_ENTRY_TYPES.map((type) => ({
        type,
        entries:
          newestRelease?.entries.filter((entry) => entry.type === type) ?? [],
      })).filter((group) => group.entries.length > 0),
    [newestRelease]
  )

  useEffect(() => {
    function openFromShortcut(event: KeyboardEvent) {
      if (!event.altKey || event.key.toLowerCase() !== "n") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setOpen(true)
    }

    document.addEventListener("keydown", openFromShortcut)
    return () => document.removeEventListener("keydown", openFromShortcut)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (open && !nextOpen && newestRelease && typeof window !== "undefined") {
      markReleaseSeen(window.localStorage, newestRelease.version)
    }
    setOpen(nextOpen)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-keyshortcuts="Alt+N"
        onClick={() => setOpen(true)}
        className={cn("relative", className)}
      >
        What&apos;s new
        {showIndicator && (
          <span
            aria-label="Unseen release"
            className="size-1.5 rounded-full bg-info"
          />
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-mobile-variant="drawer"
          className="max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>What&apos;s new</DialogTitle>
            {newestRelease ? (
              <DialogDescription>
                Version {newestRelease.version} ·{" "}
                {formatDate(newestRelease.date)}
              </DialogDescription>
            ) : (
              <DialogDescription>
                Release notes are unavailable.
              </DialogDescription>
            )}
          </DialogHeader>

          {newestRelease && (
            <div className="max-h-96 space-y-4 overflow-y-auto overscroll-contain pe-1">
              {groupedEntries.map((group) => (
                <section
                  key={group.type}
                  aria-labelledby={`whats-new-${group.type}`}
                >
                  <h3
                    id={`whats-new-${group.type}`}
                    className="mb-1 text-xs font-semibold text-foreground"
                  >
                    {typeLabel(group.type)}
                  </h3>
                  <ul role="list">
                    {group.entries.map((entry) => (
                      <li key={`${entry.pr}-${entry.text}`}>
                        <ChangelogEntry entry={entry} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              render={<Link to="/changelog" />}
              nativeButton={false}
              onClick={() => handleOpenChange(false)}
            >
              See full changelog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
