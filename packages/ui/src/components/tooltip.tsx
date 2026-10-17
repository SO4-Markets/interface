"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@workspace/ui/lib/utils"

function TooltipProvider({
  delay = 500,
  closeDelay = 0,
  timeout = 400,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={closeDelay}
      timeout={timeout}
      {...props}
    />
  )
}

function Tooltip({
  disableHoverablePopup = true,
  ...props
}: TooltipPrimitive.Root.Props) {
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      disableHoverablePopup={disableHoverablePopup}
      {...props}
    />
  )
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 max-w-xs origin-(--transform-origin) rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground ring-1 ring-foreground/10 shadow-md has-data-[slot=tooltip-description]:flex-col has-data-[slot=tooltip-description]:items-start has-data-[slot=tooltip-description]:gap-0 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-inline-start-2 data-[side=inline-start]:slide-in-from-inline-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:ms-auto **:data-[slot=kbd]:rounded-sm **:data-[slot=kbd]:border **:data-[slot=kbd]:border-border **:data-[slot=kbd]:bg-muted **:data-[slot=kbd]:px-1 **:data-[slot=kbd]:py-0.5 **:data-[slot=kbd]:text-10 **:data-[slot=kbd]:font-mono **:data-[slot=kbd]:leading-none ",
            className
          )}
          {...props}
        >
          {children}
          {/* rounded-[2px]: ds-allow: isolated visual-polish on the rotated arrow tip,
              not part of the app's --radius scale (which is 0 everywhere else) */}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-popover ring-1 ring-inset ring-foreground/10 data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-inset-inline-start-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-inset-inline-end-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

function TooltipDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="tooltip-description"
      className={cn(
        "text-xs/relaxed text-muted-foreground first:mt-0.5",
        className
      )}
      {...props}
    />
  )
}

function TooltipShortcut({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "ms-auto inline-flex items-center rounded-sm border border-border bg-muted px-1 py-0.5 text-10 font-mono leading-none",
        className
      )}
      {...props}
    />
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipDescription,
  TooltipShortcut,
  TooltipProvider,
}
