"use client"

import * as React from "react"

import { ChevronDownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

type CollapsibleLayout = "default" | "compact"

type CollapsibleProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type CollapsibleContextValue = {
  open: boolean
  triggerId: string
  contentId: string
  toggleOpen: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext(component: string) {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error(`${component} must be used within Collapsible`)
  }
  return context
}

function Collapsible({
  className,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: CollapsibleProps) {
  const generatedId = React.useId()
  const isControlled = open !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isOpen = isControlled ? open : uncontrolledOpen
  const triggerId = `${generatedId}-trigger`
  const contentId = `${generatedId}-content`

  const toggleOpen = React.useCallback(() => {
    const nextOpen = !isOpen
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }, [isControlled, isOpen, onOpenChange])

  const contextValue = React.useMemo<CollapsibleContextValue>(
    () => ({ open: isOpen, triggerId, contentId, toggleOpen }),
    [contentId, isOpen, toggleOpen, triggerId]
  )

  return (
    <CollapsibleContext.Provider value={contextValue}>
      <div
        data-slot="collapsible"
        data-state={isOpen ? "open" : "closed"}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

type CollapsibleTriggerProps = React.ComponentProps<"button"> & {
  layout?: CollapsibleLayout
}

function CollapsibleTrigger({
  className,
  children,
  layout = "default",
  onClick,
  onKeyDown,
  ...props
}: CollapsibleTriggerProps) {
  const { open, triggerId, contentId, toggleOpen } = useCollapsibleContext(
    "CollapsibleTrigger"
  )
  const suppressNextClickRef = React.useRef(false)

  return (
    <button
      id={triggerId}
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      data-slot="collapsible-trigger"
      data-state={open ? "open" : "closed"}
      className={cn(
        "group flex w-full items-center justify-between gap-3 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
        layout === "compact"
          ? "py-2 text-sm leading-5"
          : "py-3 text-sm leading-6 font-medium",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false
          return
        }
        toggleOpen()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return

        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault()
          suppressNextClickRef.current = true
          toggleOpen()
        }
      }}
      {...props}
    >
      <span>{children}</span>
      <HugeiconsIcon
        aria-hidden="true"
        icon={ChevronDownIcon}
        strokeWidth={2.5}
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-moderate group-aria-expanded:rotate-180 motion-reduce:transition-none",
          open ? "rotate-180" : "rotate-0"
        )}
      />
    </button>
  )
}

type CollapsibleContentProps = React.ComponentProps<"div">

function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsibleContentProps) {
  const { open, triggerId, contentId } = useCollapsibleContext(
    "CollapsibleContent"
  )

  return (
    <section
      id={contentId}
      aria-labelledby={triggerId}
      aria-hidden={!open}
      data-slot="collapsible-content"
      data-state={open ? "open" : "closed"}
      className={cn(
        "grid overflow-hidden text-sm leading-relaxed text-muted-foreground transition-[grid-template-rows,padding-bottom] duration-moderate motion-reduce:transition-none",
        open ? "grid-rows-[1fr] pb-3" : "grid-rows-[0fr] pb-0",
        className
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </section>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
export type { CollapsibleProps, CollapsibleTriggerProps, CollapsibleContentProps }
