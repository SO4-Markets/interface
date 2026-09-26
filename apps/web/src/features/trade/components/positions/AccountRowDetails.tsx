import { useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Numeric } from "@workspace/ui/components/numeric"
import type { StatusVariant } from "@workspace/ui/components/status-badge"

/**
 * Narrow-screen row details for the lower account workspace (OB-090).
 *
 * Wide financial tables scroll horizontally on mobile (`Table` wraps in
 * `overflow-x-auto`), which keeps geometry stable but buries essential
 * fields and actions. These cards mirror one table row with consistent
 * labels, a stable DOM order (no re-sorting on refresh), and full keyboard
 * access — rendered below the table on small viewports (`md:hidden`) while
 * the table serves desktop. Both views share the same data and labels so
 * zoom, screen readers, and keyboard traversal read rows identically.
 */

export type AccountDetailField = {
  label: string
  value: ReactNode
}

export type AccountOrderCardAction = {
  label: string
  disabled?: boolean
  disabledReason?: string
  pending?: boolean
  onClick: () => void
}

type Props = {
  /** Stable row identity — survives indexer refresh so focus is not dropped. */
  rowKey: string
  marketName: string
  sideBadge: { label: string; variant: StatusVariant }
  statusBadge?: { label: string; variant: StatusVariant }
  /** Essential fields in reading order; labels match the table headers. */
  fields: Array<AccountDetailField>
  actions: Array<AccountOrderCardAction>
  /** Size shown in the collapsed header. */
  summarySizeUsd?: number
}

export function AccountOrderCard({
  rowKey,
  marketName,
  sideBadge,
  statusBadge,
  fields,
  actions,
  summarySizeUsd,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const regionId = `account-row-details-${rowKey}`
  const buttonId = `account-row-toggle-${rowKey}`

  return (
    <article
      aria-labelledby={buttonId}
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{marketName}</span>
          <StatusBadge variant={sideBadge.variant}>{sideBadge.label}</StatusBadge>
          {statusBadge ? (
            <StatusBadge variant={statusBadge.variant}>{statusBadge.label}</StatusBadge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {summarySizeUsd !== undefined && (
            <span className="tabular-nums text-xs text-muted-foreground">
              <Numeric value={summarySizeUsd} format="usd" />
            </span>
          )}
          <Button
            id={buttonId}
            size="xs"
            variant="outline"
            aria-expanded={expanded}
            aria-controls={regionId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide details" : "Details"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div id={regionId} role="region" aria-labelledby={buttonId} className="mt-3">
          <dl className="space-y-2">
            {fields.map((field) => (
              <div key={field.label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-xs text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 text-right text-xs">{field.value}</dd>
              </div>
            ))}
          </dl>
          {actions.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  size="xs"
                  variant="outline"
                  disabled={action.disabled || action.pending}
                  title={action.disabled ? (action.disabledReason ?? "Unavailable") : undefined}
                  aria-label={
                    action.disabled
                      ? `${action.label} unavailable: ${action.disabledReason ?? "unsupported"}`
                      : `${action.label} ${marketName} order`
                  }
                  pending={action.pending}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
