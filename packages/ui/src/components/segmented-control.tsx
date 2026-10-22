"use client"

import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

export type SegmentedControlOption<T extends string = string> = {
  value: T
  label: React.ReactNode
  activeColor?: string
  className?: string
}

export type SegmentedControlProps<T extends string = string> = {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentedControlOption<T>>
  className?: string
  thumbClassName?: string
  size?: "sm" | "default" | "lg"
  disabled?: boolean
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  className,
  thumbClassName,
  size = "default",
  disabled = false,
}: SegmentedControlProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    left: number
    width: number
  }>({ left: 0, width: 0 })
  const optionRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())

  const activeIndex = options.findIndex((opt) => opt.value === value)
  const activeOption = options.find((opt) => opt.value === value)

  React.useLayoutEffect(() => {
    const el = optionRefs.current.get(value)
    const container = containerRef.current
    if (el && container) {
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      setIndicatorStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      })
    }
  }, [value, options])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      const nextIndex = (index + 1) % options.length
      onChange(options[nextIndex].value)
      optionRefs.current.get(options[nextIndex].value)?.focus()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      const prevIndex = (index - 1 + options.length) % options.length
      onChange(options[prevIndex].value)
      optionRefs.current.get(options[prevIndex].value)?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-orientation="horizontal"
      className={cn(
        "relative inline-flex items-center rounded-lg bg-muted p-[3px] select-none",
        size === "sm" && "h-7 text-xs",
        size === "default" && "h-8 text-xs",
        size === "lg" && "h-9 text-sm",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {/* Sliding spring thumb */}
      {indicatorStyle.width > 0 && (
        <div
          role="presentation"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: indicatorStyle.width,
          }}
          className={cn(
            "absolute top-[3px] bottom-[3px] rounded-md transition-[transform,width,background-color] duration-base ease-spring-smooth motion-reduce:transition-none shadow-xs pointer-events-none",
            activeOption.activeColor || "bg-background dark:bg-input/40 dark:border dark:border-input",
            thumbClassName
          )}
        />
      )}

      {options.map((option, idx) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) optionRefs.current.set(option.value, el)
              else optionRefs.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center px-2.5 py-1 font-medium transition-colors duration-fast ease-spring-snappy outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md",
              isSelected
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
              option.className
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
