"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type { buttonVariants } from "@workspace/ui/components/button"
import type { VariantProps } from "class-variance-authority"

/** Tones approved for icon-only actions — excludes `link`, which has no icon-only styling. */
type IconButtonTone = Exclude<
  NonNullable<VariantProps<typeof buttonVariants>["variant"]>,
  "link"
>

type IconButtonSize = "xs" | "sm" | "default" | "lg"

const ICON_BUTTON_SIZE_MAP: Record<
  IconButtonSize,
  NonNullable<VariantProps<typeof buttonVariants>["size"]>
> = {
  xs: "icon-xs",
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
}

interface IconButtonProps
  extends Omit<
    React.ComponentProps<typeof Button>,
    "size" | "variant" | "children"
  > {
  /** The icon to render — the button's only visible content. */
  icon: React.ReactNode
  /**
   * Accessible name for the button. Since the button has no visible text,
   * this doubles as the tooltip content unless `tooltip` overrides it.
   */
  label: string
  /** Tooltip copy, if it should differ from `label`. */
  tooltip?: React.ReactNode
  /** Approved button tone. Defaults to `ghost`, the common icon-action tone. */
  tone?: IconButtonTone
  size?: IconButtonSize
  tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"]
}

function IconButton({
  icon,
  label,
  tooltip,
  tone = "ghost",
  size = "default",
  tooltipSide = "top",
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={tone}
            size={ICON_BUTTON_SIZE_MAP[size]}
            aria-label={label}
            data-slot="icon-button"
            className={cn("touch-target", className)}
            {...props}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent side={tooltipSide}>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  )
}


export { IconButton }
export type { IconButtonProps, IconButtonTone, IconButtonSize }
