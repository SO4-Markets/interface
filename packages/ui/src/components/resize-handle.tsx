import { useCallback, useRef } from "react"

import { cn } from "@workspace/ui/lib/utils"

type Orientation = "horizontal" | "vertical"

type ResizeHandleProps = {
  /** "vertical" drags left/right and resizes a width; "horizontal" drags up/down and resizes a height. */
  orientation: Orientation
  value: number
  min: number
  max: number
  step?: number
  /** Larger increment used with Shift/PageUp/PageDown. */
  largeStep?: number
  onChange: (next: number) => void
  onReset?: () => void
  label: string
  className?: string
}

/**
 * A pointer + keyboard draggable divider between two resizable regions.
 * Implements the WAI-ARIA "window splitter" pattern: role="separator" with
 * aria-valuenow/min/max, arrow-key stepping, and Home/End for the bounds.
 *
 * Dragging updates `value` synchronously with no transition — the panel
 * itself must not animate while `onChange` fires, only decorative state
 * changes (open/close, mount) should animate.
 */
function ResizeHandle({
  orientation,
  value,
  min,
  max,
  step = 8,
  largeStep = 48,
  onChange,
  onReset,
  label,
  className,
}: ResizeHandleProps) {
  const dragState = useRef<{ startPos: number; startValue: number } | null>(null)

  const clamp = useCallback((next: number) => Math.min(max, Math.max(min, next)), [min, max])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      dragState.current = {
        startPos: orientation === "vertical" ? event.clientX : event.clientY,
        startValue: value,
      }
    },
    [orientation, value]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return
      const pos = orientation === "vertical" ? event.clientX : event.clientY
      const delta = pos - dragState.current.startPos
      onChange(clamp(dragState.current.startValue + delta))
    },
    [clamp, onChange, orientation]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragState.current = null
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const increaseKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown"
      const decreaseKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp"
      const delta = event.shiftKey ? largeStep : step

      if (event.key === increaseKey) {
        event.preventDefault()
        onChange(clamp(value + delta))
      } else if (event.key === decreaseKey) {
        event.preventDefault()
        onChange(clamp(value - delta))
      } else if (event.key === "Home") {
        event.preventDefault()
        onChange(min)
      } else if (event.key === "End") {
        event.preventDefault()
        onChange(max)
      } else if (event.key === "Enter" && onReset) {
        event.preventDefault()
        onReset()
      }
    },
    [clamp, largeStep, max, min, onChange, onReset, orientation, step, value]
  )

  return (
    <div
      data-slot="resize-handle"
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={cn(
        "group/resize-handle shrink-0 touch-none select-none bg-transparent focus-visible:outline-none",
        orientation === "vertical"
          ? "w-2 cursor-col-resize"
          : "h-2 cursor-row-resize",
        className
      )}
    >
      <div
        className={cn(
          "bg-border transition-colors group-hover/resize-handle:bg-primary/40 group-focus-visible/resize-handle:bg-primary",
          orientation === "vertical" ? "mx-auto h-full w-px" : "mx-auto h-px w-full"
        )}
      />
    </div>
  )
}

export { ResizeHandle }
export type { ResizeHandleProps }
