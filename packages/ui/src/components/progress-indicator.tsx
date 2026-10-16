import { forwardRef } from "react"
import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const progressIndicatorVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-3",
      },
      tone: {
        neutral: "bg-surface-sunken",
        accent: "bg-surface-sunken",
        success: "bg-success-subtle",
        danger: "bg-danger-subtle",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "neutral",
    },
  }
)

const progressBarVariants = cva("h-full transition-[width] duration-base ease-out", {
  variants: {
    tone: {
      neutral: "bg-text-secondary",
      accent: "bg-primary",
      success: "bg-success-foreground",
      danger: "bg-danger-foreground",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
})

interface ProgressIndicatorProps
  extends
    React.ComponentProps<"div">,
    VariantProps<typeof progressIndicatorVariants> {
  value?: number
  max?: number
  min?: number
  label?: string
}

const ProgressIndicator = forwardRef<HTMLDivElement, ProgressIndicatorProps>(
  (
    {
      className,
      size = "md",
      tone = "neutral",
      value = 0,
      max = 100,
      min = 0,
      label,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.min(Math.max(value, min), max)
    const percentage =
      max === min ? 0 : ((clampedValue - min) / (max - min)) * 100

    return (
      <div
        ref={ref}
        data-slot="progress-indicator"
        data-tone={tone}
        className={cn(progressIndicatorVariants({ size, tone }), className)}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={min}
        aria-valuemax={max}
        {...(label && { "aria-label": label })}
        {...props}
      >
        <div
          data-slot="progress-bar"
          className={cn(progressBarVariants({ tone }))}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    )
  }
)
ProgressIndicator.displayName = "ProgressIndicator"

export {
  ProgressIndicator,
  progressIndicatorVariants,
  type ProgressIndicatorProps,
}
