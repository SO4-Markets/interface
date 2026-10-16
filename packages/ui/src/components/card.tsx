import { forwardRef } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const cardVariants = cva("rounded-xl border transition-colors outline-none", {
  variants: {
    variant: {
      /** Default raised surface — cards, panels, sidebars. */
      default: "border-border bg-card",
      /** Recessed surface for supporting information. */
      subtle: "border-border bg-muted/20",
      /** Interactive card with hover and active states. */
      interactive: "border-border bg-card hover:bg-surface-interactive hover:border-border/80 cursor-pointer active:bg-surface-interactive/80 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50",
      /** Placeholder surface for "nothing here yet". */
      dashed: "border-dashed border-border bg-muted/10",
      /** Frame only — used when the body is a table that paints its own rows. */
      plain: "border-border bg-transparent overflow-hidden",
    },
    padding: {
      none: "",
      compact: "p-3",
      default: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: { variant: "default", padding: "none" },
})

const Card = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & VariantProps<typeof cardVariants>
>(({ className, variant, padding, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn(cardVariants({ variant, padding }), className)}
    {...props}
  />
))
Card.displayName = "Card"

/** Header strip with a bottom rule — the standard table/card caption row. */
const CardHeader = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn("border-b border-border px-5 py-3.5", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = forwardRef<HTMLHeadingElement, React.ComponentProps<"h3">>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-slot="card-title"
      className={cn("text-sm font-semibold text-text-primary", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="card-description"
      className={cn("text-13 text-text-secondary", className)}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="card-content" className={cn("p-5", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-5 pb-5", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
