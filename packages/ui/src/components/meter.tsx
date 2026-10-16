import { cva } from "class-variance-authority"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

// ---------------------------------------------------------------------------
// Meter (DS-063) — single-value semantic gauge
// ---------------------------------------------------------------------------

type MeterThreshold = "neutral" | "success" | "warning" | "danger"

const meterTrackVariants = cva("relative w-full overflow-hidden rounded-full", {
  variants: {
    size: {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    },
  },
  defaultVariants: { size: "md" },
})

const meterFillVariants = cva("h-full transition-[width] duration-base ease-out", {
  variants: {
    threshold: {
      neutral: "bg-text-secondary",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-destructive",
    },
  },
  defaultVariants: { threshold: "neutral" },
})

const meterBackgroundVariants = cva("", {
  variants: {
    threshold: {
      neutral: "bg-surface-sunken",
      success: "bg-success-subtle",
      warning: "bg-warning/10",
      danger: "bg-danger-subtle",
    },
  },
  defaultVariants: { threshold: "neutral" },
})

interface MeterProps
  extends
    Omit<ComponentProps<"div">, "role">,
    VariantProps<typeof meterTrackVariants> {
  value: number
  min?: number
  max?: number
  label: string
  threshold?: MeterThreshold
}

function Meter({
  value,
  min = 0,
  max = 100,
  label,
  threshold = "neutral",
  size = "md",
  className,
  ...props
}: MeterProps) {
  const clamped = Math.min(Math.max(value, min), max)
  const pct = max === min ? 0 : ((clamped - min) / (max - min)) * 100

  return (
    <div
      data-slot="meter"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        meterTrackVariants({ size }),
        meterBackgroundVariants({ threshold }),
        className
      )}
      {...props}
    >
      <div
        data-slot="meter-fill"
        className={cn(meterFillVariants({ threshold }))}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// AllocationBar (DS-063) — segmented proportional bar
// ---------------------------------------------------------------------------

interface AllocationSegment {
  label: string
  value: number
  color?: string
}

const MIN_SEGMENT_PCT = 1

function normalizeSegments(segments: Array<AllocationSegment>): Array<{
  label: string
  value: number
  pct: number
  color: string
}> {
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  if (total === 0) {
    return segments.map((s, i) => ({
      label: s.label,
      value: s.value,
      pct: 0,
      color: s.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }))
  }

  const raw = segments.map((s) => (s.value / total) * 100)

  const adjusted = raw.map((pct) => {
    if (pct === 0) return 0
    return Math.max(pct, MIN_SEGMENT_PCT)
  })

  const adjustedTotal = adjusted.reduce((sum, p) => sum + p, 0)
  const excess = Math.max(0, adjustedTotal - 100)
  const reducibleTotal = adjusted.reduce(
    (sum, pct) => sum + Math.max(0, pct - MIN_SEGMENT_PCT),
    0
  )

  // Pay for raised tiny segments from larger segments while preserving the
  // minimum. Renormalizing every segment would shrink tiny segments below it.
  const normalized = adjusted.map((pct) => {
    const reducible = Math.max(0, pct - MIN_SEGMENT_PCT)
    return reducibleTotal === 0
      ? pct
      : pct - excess * (reducible / reducibleTotal)
  })

  return segments.map((s, i) => ({
    label: s.label,
    value: s.value,
    pct: normalized[i],
    color: s.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }))
}

const SEGMENT_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-info)",
  "var(--color-muted-foreground)",
]

interface AllocationBarProps extends ComponentProps<"div"> {
  segments: Array<AllocationSegment>
  size?: "sm" | "md" | "lg"
  showLegend?: boolean
}

const allocationSizeMap = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

function AllocationBar({
  segments,
  size = "md",
  showLegend = true,
  className,
  ...props
}: AllocationBarProps) {
  const normalized = normalizeSegments(segments)
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <div
      data-slot="allocation-bar"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-full",
          allocationSizeMap[size]
        )}
        role="img"
        aria-label={`Allocation: ${normalized
          .map(
            (s) =>
              `${s.label} ${total === 0 ? 0 : ((s.value / total) * 100).toFixed(1)}%`
          )
          .join(", ")}`}
      >
        {normalized.map((segment) => (
          <Tooltip key={segment.label}>
            <TooltipTrigger
              render={
                <div
                  className="h-full transition-[width] duration-base ease-out first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${segment.pct}%`,
                    backgroundColor: segment.color,
                  }}
                />
              }
            />
            <TooltipContent>
              {segment.label}:{" "}
              {total === 0
                ? "0%"
                : `${((segment.value / total) * 100).toFixed(1)}%`}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {showLegend && (
        <div
          data-slot="allocation-legend"
          className="flex flex-wrap gap-x-4 gap-y-1"
        >
          {normalized.map((segment) => (
            <span
              key={segment.label}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              {segment.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export {
  Meter,
  AllocationBar,
  normalizeSegments,
  meterTrackVariants,
  meterFillVariants,
}
export type {
  MeterProps,
  MeterThreshold,
  AllocationBarProps,
  AllocationSegment,
}
