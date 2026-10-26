import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const statusBadgeVariants = cva(
  "group/status-badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-10 font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "border-success-border bg-success-subtle text-success-foreground",
        warning: "border-warning-border bg-warning text-warning-foreground",
        danger: "text-danger border-danger-border bg-danger-subtle",
        "danger-subtle":
          "text-danger border-danger-border bg-danger-subtle",
        info: "border-info-border bg-info text-info-foreground",
        "info-subtle": "border-info-border bg-info-subtle text-info-foreground",
        muted: "border-border bg-muted text-foreground",
        neutral: "border-neutral-border bg-neutral-subtle text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

type StatusVariant = VariantProps<typeof statusBadgeVariants>["variant"]

interface StatusBadgeProps {
  variant: StatusVariant
  children: React.ReactNode
  className?: string
}

function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ variant }), className)}
    >
      {children}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
export type { StatusVariant }
