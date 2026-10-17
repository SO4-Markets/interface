import * as React from "react"
import { Slider } from "@workspace/ui/components/slider"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

type LeverageSliderProps = {
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (value: number) => void
}

export function LeverageSlider({ min = 1, max = 50, step = 0.5, value, onChange }: LeverageSliderProps) {
  const detents = React.useMemo(() => {
    const base = [1, 2, 5, 10, max].filter((d) => d >= min && d <= max)
    return Array.from(new Set(base)).sort((a, b) => a - b)
  }, [min, max])

  const riskLevel = React.useMemo(() => {
    if (value <= 2) return "low"
    if (value <= 5) return "medium"
    if (value <= 15) return "high"
    return "extreme"
  }, [value])

  const riskStyles = React.useMemo(() => {
    switch (riskLevel) {
      case "extreme":
        return {
          badge: "border-destructive/50 text-destructive bg-destructive/10",
          bubble: "border-destructive/60 bg-card text-destructive",
          track: "bg-destructive",
        }
      case "high":
        return {
          badge: "border-warning/50 text-warning bg-warning/10",
          bubble: "border-warning/60 bg-card text-warning",
          track: "bg-warning",
        }
      case "medium":
        return {
          badge: "border-info/50 text-info bg-info/10",
          bubble: "border-info/50 bg-card text-info",
          track: "bg-primary",
        }
      default:
        return {
          badge: "border-border text-foreground bg-secondary",
          bubble: "border-border bg-card text-foreground",
          track: "bg-primary",
        }
    }
  }, [riskLevel])

  const handleValueChange = (newVal: number) => {
    // Snap to nearest detent if within a small threshold
    const snapDetent = detents.find((d) => Math.abs(d - newVal) <= 0.35)
    onChange(snapDetent !== undefined ? snapDetent : newVal)
  }

  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Leverage</span>
        <Badge
          variant="secondary"
          className={cn(
            "transition-colors duration-base ease-in-out font-mono font-medium",
            riskStyles.badge
          )}
        >
          {value}×
        </Badge>
      </div>

      <div className="relative pt-4 w-full">
        <div
          style={{ left: `${percent}%` }}
          className={cn(
            "absolute top-0 -translate-x-1/2 pointer-events-none z-10",
            "rounded border px-1 py-0.2 text-[10px] font-mono font-semibold shadow-xs",
            "transition-[left,color,border-color,background-color] duration-fast ease-spring-snappy motion-reduce:transition-none",
            riskStyles.bubble
          )}
          aria-hidden="true"
        >
          {value}x
        </div>

        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(v) => handleValueChange(Array.isArray(v) ? v[0] : v)}
          indicatorClassName={riskStyles.track}
          className="w-full"
        />
      </div>

      <div className="relative flex justify-between text-xs text-muted-foreground select-none">
        <span>{min}×</span>
        <div className="absolute inset-x-0 top-0 flex pointer-events-none items-center h-full">
          {detents.map((stop) => {
            if (stop === min || stop === max) return null
            const stopPct = ((stop - min) / (max - min)) * 100
            const isSelected = value === stop
            return (
              <button
                key={stop}
                type="button"
                tabIndex={-1}
                onClick={() => onChange(stop)}
                aria-label={`Snap to ${stop}x`}
                style={{ left: `${stopPct}%` }}
                className={cn(
                  "absolute -translate-x-1/2 pointer-events-auto flex flex-col items-center group cursor-pointer",
                  "transition-transform duration-fast ease-spring-snappy motion-reduce:transition-none hover:scale-110"
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-0.5 rounded-full transition-colors duration-fast",
                    isSelected ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-mono leading-tight transition-colors duration-fast",
                    isSelected ? "text-foreground font-semibold" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {stop}x
                </span>
              </button>
            )
          })}
        </div>
        <span>{max}×</span>
      </div>
    </div>
  )
}
