import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent font-medium whitespace-nowrap transition-all-subtle focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-2.5!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        success:
          "border-success/20 bg-success/10 text-success [a]:hover:bg-success/20",
        warning:
          "border-warning/20 bg-warning/10 text-warning [a]:hover:bg-warning/20",
        info: "border-info/20 bg-info/10 text-info [a]:hover:bg-info/20",
        muted: "border-border bg-muted/60 text-muted-foreground",
        outline:
          "border-border bg-input/20 text-foreground dark:bg-input/30 [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        neutral:
          "bg-neutral/10 text-neutral focus-visible:ring-neutral/20 dark:bg-neutral/20 dark:focus-visible:ring-neutral/40 [a]:hover:bg-neutral/20",
        danger:
          "bg-danger/10 text-danger focus-visible:ring-danger/20 dark:bg-danger/20 dark:focus-visible:ring-danger/40 [a]:hover:bg-danger/20",
        long:
          "bg-neutral/10 text-neutral focus-visible:ring-neutral/20 dark:bg-neutral/20 dark:focus-visible:ring-neutral/40 [a]:hover:bg-neutral/20 px-3 py-1 has-data-[slot=badge-icon]:ps-2",
        short:
          "bg-neutral/10 text-neutral focus-visible:ring-neutral/20 dark:bg-neutral/20 dark:focus-visible:ring-neutral/40 size-2.5 min-w-0 p-0 justify-center [&>svg]:size-2 [&>svg]:mx-auto",
      },
      size: {
        default: "h-5 text-10 px-2 py-0.5",
        sm: "h-4 text-8 px-1.5 py-px",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  })
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export { Badge, badgeVariants }
export type { BadgeVariant }
