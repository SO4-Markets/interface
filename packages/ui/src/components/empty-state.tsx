import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

/**
 * Canonical empty-state primitive.
 *
 * This module is the single source of truth for empty states in
 * `@workspace/ui`. The former `empty.tsx` composable primitives were folded
 * into this component, and `states.tsx` re-exports `EmptyState` rather than
 * shipping a second implementation.
 */

// ---------------------------------------------------------------------------
// Layout variants
// ---------------------------------------------------------------------------

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center animate-in fade-in duration-slowest motion-reduce:animate-none",
  {
    variants: {
      variant: {
        /** Fits inside a table cell, card body, or panel section. */
        compact: "gap-2 px-4 py-8",
        /** Full-page / large-area empty state. */
        page: "gap-4 px-6 py-20",
      },
    },
    defaultVariants: {
      variant: "compact",
    },
  }
)

const iconWrapperVariants = cva(
  "flex items-center justify-center rounded-full text-muted-foreground animate-in fade-in zoom-in-75 duration-slow motion-reduce:animate-none",
  {
    variants: {
      variant: {
        compact: "size-10 bg-muted/60",
        page: "size-14 bg-muted/60",
      },
    },
    defaultVariants: {
      variant: "compact",
    },
  }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An action slot accepts any React node – typically a `<button>` or an `<a>`
 * so callers keep full control over routing, styling, and aria attributes.
 */
export interface EmptyStateActionProps {
  /** Primary call-to-action (button or link element). */
  primary?: React.ReactNode
  /** Secondary / dismiss action (button or link element). */
  secondary?: React.ReactNode
}

export interface EmptyStateProps
  // Omit `title` because HTMLDivElement defines it as `string`, which conflicts
  // with our ReactNode headline prop below.
  extends
    Omit<React.ComponentProps<"div">, "title">,
    VariantProps<typeof emptyStateVariants> {
  /** Icon node (any SVG or component). Rendered inside a soft circular badge. */
  icon?: React.ReactNode
  /** Short headline text or element. */
  title?: React.ReactNode
  /** Supporting description copy. */
  description?: React.ReactNode
  /** Primary and/or secondary action nodes. */
  actions?: EmptyStateActionProps
  /**
   * @deprecated Use `actions.primary` instead. Kept as a shorthand so callers
   * importing `EmptyState` from `@workspace/ui/components/states` continue to
   * typecheck while they migrate.
   */
  action?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function EmptyState({
  variant = "compact",
  icon,
  title,
  description,
  actions,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const primaryAction = actions?.primary ?? action
  const hasActions = primaryAction != null || actions?.secondary != null

  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      role="status"
      className={cn(emptyStateVariants({ variant }), className)}
      {...props}
    >
      {icon != null && (
        <div
          aria-hidden="true"
          className={cn(iconWrapperVariants({ variant }))}
        >
          {icon}
        </div>
      )}

      {(title != null || description != null) && (
        <div className="flex flex-col gap-1">
          {title != null && (
            <p
              data-slot="empty-state-title"
              className={cn(
                "font-medium text-foreground",
                variant === "page" ? "text-base" : "text-sm"
              )}
            >
              {title}
            </p>
          )}

          {description != null && (
            <p
              data-slot="empty-state-description"
              className={cn(
                "text-muted-foreground",
                variant === "page" ? "text-sm" : "text-xs"
              )}
            >
              {description}
            </p>
          )}
        </div>
      )}

      {hasActions && (
        <div
          data-slot="empty-state-actions"
          className={cn(
            "flex flex-wrap items-center justify-center",
            variant === "page" ? "mt-2 gap-3" : "mt-1 gap-2"
          )}
        >
          {primaryAction}
          {actions?.secondary}
        </div>
      )}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
