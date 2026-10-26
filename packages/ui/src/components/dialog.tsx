import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "./icon"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" className="touch-target" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "so4-dialog-overlay fixed inset-0 isolate z-50 bg-black/80 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}


function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // Positioning & sizing
          // Centering offset lives in .so4-dialog-content (globals.css) together with
          // the enter/exit scale; adding Tailwind's translate utilities here too
          // would apply the -50% shift twice and push the dialog off-screen.
          "fixed top-1/2 start-1/2 z-50 w-full max-w-[calc(100%-2rem)] origin-(--transform-origin)",
          // Mobile: cap height so content scrolls inside rather than overflowing the viewport
          "max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto",
          // Layout, surface, typography
          "flex flex-col gap-4 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground",
          "ring-1 ring-foreground/10 outline-none",
          // Safe areas for mobile layouts
          "max-sm:safe-top max-sm:safe-bottom max-sm:safe-left max-sm:safe-right",
          // Desktop max-width default
          "sm:max-w-sm",
          // Enter / exit animations
          "so4-dialog-content",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2 touch-target" // <-- AGREGADO AQUÍ
                size="icon-sm"
              />
            }
          >
            <Icon icon={Cancel01Icon} size="md" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-sm font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-xs/relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
