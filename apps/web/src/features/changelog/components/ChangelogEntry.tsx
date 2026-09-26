import { Badge } from "@workspace/ui/components/badge"
import { areaLabel, typeLabel, typeToVariant } from "../utils"
import { InlineMarkdown } from "./InlineMarkdown"
import type { ChangelogEntry as IChangelogEntry } from "../types"

interface ChangelogEntryProps {
  entry: IChangelogEntry
  highlight?: string
}

export function ChangelogEntry({ entry, highlight }: ChangelogEntryProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between py-3 border-b border-border last:border-b-0">
      {/* Left side: badges and text */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge
            variant={typeToVariant(entry.type) as any}
            size="sm"
            className="shrink-0"
          >
            {typeLabel(entry.type)}
          </Badge>
          {/* Area label — absent for pre-tooling historical entries */}
          {entry.area && (
            <span className="text-caption text-text-tertiary shrink-0">
              {areaLabel(entry.area)}
            </span>
          )}
        </div>
        {/* Entry text with inline markdown rendered as React elements
            (links, code, emphasis) — raw HTML is escaped, never injected. */}
        <p className="text-body text-text-secondary break-words">
          <InlineMarkdown text={entry.text} query={highlight} />
        </p>
      </div>

      {/* Right side: PR link - touch target 44×44 */}
      {entry.pr && (
        <div className="mt-2 sm:mt-0 sm:ml-4 shrink-0">
          <a
            href={`https://github.com/Levee-HQ/interface/pull/${entry.pr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 min-w-11 items-center justify-center px-3 text-xs/relaxed font-medium text-info transition-colors hover:text-info/80"
          >
            #{entry.pr}
          </a>
        </div>
      )}
    </div>
  )
}
