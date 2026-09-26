"use client"

import * as React from "react"

import { ChevronDownIcon } from "@hugeicons/core-free-icons"
import { cn } from "@workspace/ui/lib/utils"
import { Icon } from "./icon"

type AccordionType = "single" | "multiple"

type AccordionBaseProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  type?: AccordionType
  collapsible?: boolean
}

type SingleAccordionProps = AccordionBaseProps & {
  type?: "single"
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
}

type MultipleAccordionProps = AccordionBaseProps & {
  type: "multiple"
  value?: Array<string>
  defaultValue?: Array<string>
  onValueChange?: (value: Array<string>) => void
}

type AccordionProps = SingleAccordionProps | MultipleAccordionProps

type AccordionContextValue = {
  type: AccordionType
  openValues: Array<string>
  collapsible: boolean
  toggleValue: (value: string) => void
}

type AccordionItemContextValue = {
  value: string
  disabled: boolean
  open: boolean
  triggerId: string
  contentId: string
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)
const AccordionItemContext =
  React.createContext<AccordionItemContextValue | null>(null)

function useAccordionContext(component: string) {
  const context = React.useContext(AccordionContext)
  if (!context) {
    throw new Error(`${component} must be used within Accordion`)
  }
  return context
}

function useAccordionItemContext(component: string) {
  const context = React.useContext(AccordionItemContext)
  if (!context) {
    throw new Error(`${component} must be used within AccordionItem`)
  }
  return context
}

function Accordion(props: AccordionProps) {
  const {
    className,
    type = "single",
    defaultValue,
    value,
    onValueChange,
    collapsible = true,
    ...rootProps
  } = props

  const isControlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | null | Array<string>
  >(() => {
    if (type === "multiple") return defaultValue ?? []
    return defaultValue ?? null
  })
  const currentValue = isControlled ? value : uncontrolledValue
  const currentValueRef = React.useRef(currentValue)
  currentValueRef.current = currentValue

  const openValues = React.useMemo(() => {
    if (type === "multiple")
      return Array.isArray(currentValue) ? currentValue : []
    return typeof currentValue === "string" ? [currentValue] : []
  }, [currentValue, type])

  const toggleValue = React.useCallback(
    (itemValue: string) => {
      const currentOpenValues =
        type === "multiple"
          ? Array.isArray(currentValueRef.current)
            ? currentValueRef.current
            : []
          : typeof currentValueRef.current === "string"
            ? [currentValueRef.current]
            : []

      if (type === "multiple") {
        const nextValue = currentOpenValues.includes(itemValue)
          ? currentOpenValues.filter((openValue) => openValue !== itemValue)
          : [...currentOpenValues, itemValue]
        const multipleOnValueChange =
          onValueChange as MultipleAccordionProps["onValueChange"]

        currentValueRef.current = nextValue
        if (!isControlled) setUncontrolledValue(nextValue)
        multipleOnValueChange?.(nextValue)
        return
      }

      const isOpen = currentOpenValues.includes(itemValue)
      const nextValue = isOpen && collapsible ? null : itemValue
      const singleOnValueChange =
        onValueChange as SingleAccordionProps["onValueChange"]

      currentValueRef.current = nextValue
      if (!isControlled) setUncontrolledValue(nextValue)
      singleOnValueChange?.(nextValue)
    },
    [collapsible, isControlled, onValueChange, type]
  )

  const contextValue = React.useMemo<AccordionContextValue>(
    () => ({ type, openValues, collapsible, toggleValue }),
    [collapsible, openValues, toggleValue, type]
  )

  return (
    <AccordionContext.Provider value={contextValue}>
      <div
        data-slot="accordion"
        data-type={type}
        className={cn("w-full", className)}
        {...rootProps}
      />
    </AccordionContext.Provider>
  )
}

type AccordionItemProps = React.ComponentProps<"div"> & {
  value: string
  disabled?: boolean
}

function AccordionItem({
  className,
  value,
  disabled = false,
  ...props
}: AccordionItemProps) {
  const { openValues } = useAccordionContext("AccordionItem")
  const generatedId = React.useId()
  const open = openValues.includes(value)
  const triggerId = `${generatedId}-trigger`
  const contentId = `${generatedId}-content`

  const contextValue = React.useMemo<AccordionItemContextValue>(
    () => ({ value, disabled, open, triggerId, contentId }),
    [contentId, disabled, open, triggerId, value]
  )

  return (
    <AccordionItemContext.Provider value={contextValue}>
      <div
        data-slot="accordion-item"
        data-state={open ? "open" : "closed"}
        data-disabled={disabled ? "" : undefined}
        className={cn(
          "group border-b border-border/60 last:border-b-0",
          className
        )}
        {...props}
      />
    </AccordionItemContext.Provider>
  )
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type AccordionTriggerProps = React.ComponentProps<"button"> & {
  headingLevel?: HeadingLevel
  showIcon?: boolean
}

function AccordionTrigger({
  className,
  children,
  headingLevel = 3,
  showIcon = true,
  onClick,
  ...props
}: AccordionTriggerProps) {
  const { toggleValue } = useAccordionContext("AccordionTrigger")
  const { value, disabled, open, triggerId, contentId } =
    useAccordionItemContext("AccordionTrigger")
  const Heading = `h${headingLevel}` as React.ElementType

  return (
    <Heading data-slot="accordion-heading">
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={contentId}
        data-slot="accordion-trigger"
        data-state={open ? "open" : "closed"}
        className={cn(
          "group flex w-full items-center justify-between gap-3 py-3 text-left text-xs leading-snug font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) toggleValue(value)
        }}
        {...props}
      >
        <span>{children}</span>
        {showIcon && (
          <Icon
            icon={ChevronDownIcon}
            strokeWidth={2.5}
            size="sm"
            tone="muted"
            className="shrink-0 transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none"
          />
        )}
      </button>
    </Heading>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, triggerId, contentId } =
    useAccordionItemContext("AccordionContent")

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      aria-hidden={!open}
      // `aria-hidden` alone hides the panel from assistive tech but doesn't
      // remove focusable descendants (a link/button) from the tab order —
      // WCAG 4.1.2 fails when a hidden region can still receive focus.
      // `inert` does both natively: not focusable, not in the AT tree.
      inert={!open}
      data-slot="accordion-content"
      data-state={open ? "open" : "closed"}
      className={cn(
        "grid overflow-hidden text-11 leading-relaxed text-muted-foreground transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="pb-3 opacity-0 transition-opacity duration-200 group-data-[state=open]:opacity-100 motion-reduce:transition-none">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
export type {
  AccordionProps,
  AccordionItemProps,
  AccordionTriggerProps,
  HeadingLevel,
}
