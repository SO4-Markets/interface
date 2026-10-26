"use client"

import * as React from "react"

import { useOverflowEdges } from "@workspace/ui/hooks/use-overflow-edges"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Shared data-table primitives.
 *
 * `Table` wraps the `<table>` in its own horizontally scrollable container so
 * wide financial tables never push the page body sideways on mobile.
 *
 * A scroll container with no focusable content cannot be scrolled by keyboard
 * (axe `scrollable-region-focusable`), so the container becomes a tab stop —
 * but only while it actually overflows, so tables that fit do not litter the
 * page with empty tab stops. Give the `<table>` an `aria-label` or
 * `aria-labelledby` and the stop is announced as a named region; without a
 * name it stays an unlabelled tab stop, because an anonymous `role="region"`
 * is worse than none.
 */
function Table({
  className,
  containerClassName,
  containerOnScroll,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string; containerOnScroll?: React.UIEventHandler<HTMLDivElement> }) {
  const [scrollable, setScrollable] = React.useState(false)
  const { rootRef, viewportRef } = useOverflowEdges(
    "horizontal",
    React.useCallback(
      (edges: { left: boolean; right: boolean }) =>
        setScrollable(edges.left || edges.right),
      []
    )
  )

  // The container is both the measured root and the scrolling viewport.
  const setContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      viewportRef.current = node
    },
    [rootRef, viewportRef]
  )

  const ariaLabel = props["aria-label"]
  const ariaLabelledBy = props["aria-labelledby"]
  const labelled = Boolean(ariaLabel || ariaLabelledBy)

  return (
    <div
      ref={setContainer}
      data-slot="table-container"
      onScroll={containerOnScroll}
      role={scrollable && labelled ? "region" : undefined}
      tabIndex={scrollable ? 0 : undefined}
      aria-label={scrollable && labelled ? ariaLabel : undefined}
      aria-labelledby={scrollable && labelled ? ariaLabelledBy : undefined}
      className={cn(
        "w-full overflow-x-auto",
        scrollable &&
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full text-xs", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

/** Header row. Carries the muted fill + bottom rule. */
function TableHeadRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-head-row"
      className={cn("border-b border-border bg-muted/25 text-start", className)}
      {...props}
    />
  )
}

function TableHead({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & {
  align?: "left" | "right"
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-5 py-[var(--density-padding-cell)] font-medium text-muted-foreground",
        align === "right" && "text-right",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  interactive = true,
  ...props
}: React.ComponentProps<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/40 last:border-b-0",
        interactive && "transition-colors hover:bg-muted/20",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & {
  align?: "left" | "right"
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-5 py-[var(--density-padding-cell)]", align === "right" && "text-right", className)}
      {...props}
    />
  )
}

/** Full-width row used to host an `EmptyState` inside a table body. */
function TableEmptyRow({
  colSpan,
  className,
  children,
  ...props
}: React.ComponentProps<"td"> & { colSpan: number }) {
  return (
    <tr data-slot="table-empty-row">
      <td colSpan={colSpan} className={cn("px-5 py-10", className)} {...props}>
        {children}
      </td>
    </tr>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableHeadRow,
  TableHead,
  TableRow,
  TableCell,
  TableEmptyRow,
}