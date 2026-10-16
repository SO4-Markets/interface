"use client"

import * as React from "react"
import { cva } from "class-variance-authority"

import { useOverflowEdges } from "@workspace/ui/hooks/use-overflow-edges"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OverflowEdges,
  ScrollAxis,
} from "@workspace/ui/hooks/use-overflow-edges"
import type { VariantProps } from "class-variance-authority"

// ---------------------------------------------------------------------------
// ScrollArea (DS-079) — overflow container with edge affordances
// ---------------------------------------------------------------------------

const viewportVariants = cva("min-h-0 min-w-0 flex-1 scroll-area-scrollbars", {
  variants: {
    orientation: {
      vertical: "overflow-x-hidden overflow-y-auto",
      horizontal: "overflow-x-auto overflow-y-hidden",
      both: "overflow-auto",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

/**
 * Edge shadows are driven entirely by the `data-overflow-*` attributes the
 * hook writes, so they cost no renders. The gradient fades to the surface the
 * area sits on — pick the one that matches the container, or the shadow reads
 * as a grey smear.
 */
const edgeVariants = cva(
  "pointer-events-none absolute z-10 opacity-0 transition-opacity duration-base motion-reduce:transition-none",
  {
    variants: {
      tone: {
        canvas: "from-surface-canvas",
        raised: "from-surface-raised",
        overlay: "from-surface-overlay",
        card: "from-card",
      },
      edge: {
        top: "inset-x-0 top-0 h-4 bg-gradient-to-b to-transparent group-data-[overflow-top=true]/scroll-area:opacity-100",
        bottom:
          "inset-x-0 bottom-0 h-4 bg-gradient-to-t to-transparent group-data-[overflow-bottom=true]/scroll-area:opacity-100",
        left: "inset-y-0 left-0 w-4 bg-gradient-to-r to-transparent group-data-[overflow-left=true]/scroll-area:opacity-100",
        right:
          "inset-y-0 right-0 w-4 bg-gradient-to-l to-transparent group-data-[overflow-right=true]/scroll-area:opacity-100",
      },
    },
    defaultVariants: { tone: "canvas", edge: "top" },
  }
)

export interface ScrollAreaProps
  extends React.ComponentProps<"div">,
    Pick<VariantProps<typeof edgeVariants>, "tone"> {
  /**
   * Which axes may overflow. The cross axis is clipped, so a vertical list
   * cannot be dragged sideways by a stray trackpad gesture.
   * @default "vertical"
   */
  orientation?: ScrollAxis
  /**
   * Fade the edges that still have content behind them.
   * @default true
   */
  edgeShadows?: boolean
  /**
   * Make the viewport itself a tab stop so arrow keys and Page Up/Down can
   * scroll it. Needed when the content has no focusable children of its own
   * (a long block of text, a read-only log); pair it with `aria-label` so the
   * stop is announced. Content that already contains links, rows, or inputs is
   * reachable without it — the browser scrolls focused elements into view.
   * @default false
   */
  focusable?: boolean
  /** Classes for the scrolling element rather than the outer wrapper. */
  viewportClassName?: string
  /**
   * Notified when the set of overflowing edges changes. Opt-in: subscribing
   * moves the edge state into React and re-renders on it, which the CSS-driven
   * default deliberately avoids.
   */
  onEdgesChange?: (edges: OverflowEdges) => void
}

/**
 * A native scroll container with optional edge shadows that appear only when
 * there is more content in that direction.
 *
 * Scrolling stays native — momentum, overscroll, wheel, trackpad, and the
 * user's own scrollbar preference are all untouched; only the scrollbar's
 * colours are themed (see the `scroll-area-scrollbars` utility). Nothing is
 * virtualized: long tables should still be windowed by the table layer.
 *
 * ```tsx
 * <ScrollArea className="max-h-80" tone="overlay">
 *   <CommandList />
 * </ScrollArea>
 *
 * <ScrollArea orientation="horizontal" tone="card">
 *   <TabsList />
 * </ScrollArea>
 * ```
 */
function ScrollArea({
  orientation = "vertical",
  edgeShadows = true,
  tone = "canvas",
  focusable = false,
  className,
  viewportClassName,
  onEdgesChange,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ScrollAreaProps) {
  const { rootRef, viewportRef } = useOverflowEdges(orientation, onEdgesChange)

  const showVertical = edgeShadows && orientation !== "horizontal"
  const showHorizontal = edgeShadows && orientation !== "vertical"
  const labelled = Boolean(ariaLabel || ariaLabelledBy)

  return (
    <div
      ref={rootRef}
      data-slot="scroll-area"
      data-orientation={orientation}
      className={cn(
        "group/scroll-area relative flex min-h-0 min-w-0 flex-col",
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-s data-vertical:border-s-transparent",
        className
      )}
      {...props}
    >
      <div
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        // A focusable scroll region needs a name to be a useful tab stop; an
        // unnamed `role="region"` is worse than no role at all.
        role={focusable && labelled ? "region" : undefined}
        tabIndex={focusable ? 0 : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          viewportVariants({ orientation }),
          focusable &&
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          viewportClassName
        )}
      >
        {children}
      </div>

      {showVertical && (
        <>
          <span
            aria-hidden="true"
            data-slot="scroll-area-edge"
            data-edge="top"
            className={edgeVariants({ edge: "top", tone })}
          />
          <span
            aria-hidden="true"
            data-slot="scroll-area-edge"
            data-edge="bottom"
            className={edgeVariants({ edge: "bottom", tone })}
          />
        </>
      )}

      {showHorizontal && (
        <>
          <span
            aria-hidden="true"
            data-slot="scroll-area-edge"
            data-edge="left"
            className={edgeVariants({ edge: "left", tone })}
          />
          <span
            aria-hidden="true"
            data-slot="scroll-area-edge"
            data-edge="right"
            className={edgeVariants({ edge: "right", tone })}
          />
        </>
      )}
    </div>
  )
}

export { ScrollArea, edgeVariants, viewportVariants }
