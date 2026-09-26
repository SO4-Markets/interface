import { useEffect, useRef, useState } from "react"

export type NumericChangeTrend = "up" | "down" | "none"

export type UseNumericChangeFeedbackOptions = {
  value: number | null | undefined
  /** Coalesce duration in ms. Defaults to 500ms. */
  coalesceMs?: number
  /** Disable emphasis (e.g. reduced motion). Defaults to false. */
  disabled?: boolean
}

export type UseNumericChangeFeedbackResult = {
  trend: NumericChangeTrend
  isEmphasized: boolean
  className: string
}

/**
 * Hook providing restrained numeric-change feedback (OB-019).
 *
 * Emphasizes direction ('up' / 'down') using a non-moving tone/background cue while
 * ensuring numeric updates happen immediately with stable tabular figures, constant
 * layout width, no rolling digit movement, and coalesce bursts without generating
 * live-region announcements for every tick.
 */
export function useNumericChangeFeedback({
  value,
  coalesceMs = 500,
  disabled = false,
}: UseNumericChangeFeedbackOptions): UseNumericChangeFeedbackResult {
  const prevRef = useRef<number | null | undefined>(value)
  const [trend, setTrend] = useState<NumericChangeTrend>("none")
  const [isEmphasized, setIsEmphasized] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (disabled) {
      setTrend("none")
      setIsEmphasized(false)
      return
    }

    const prev = prevRef.current
    prevRef.current = value

    if (
      prev !== undefined &&
      prev !== null &&
      value !== undefined &&
      value !== null &&
      prev !== value
    ) {
      const nextTrend: NumericChangeTrend = value > prev ? "up" : "down"
      setTrend(nextTrend)
      setIsEmphasized(true)

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        setIsEmphasized(false)
        setTrend("none")
        timerRef.current = null
      }, coalesceMs)
    }
  }, [value, coalesceMs, disabled])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const className = isEmphasized
    ? trend === "up"
      ? "bg-success/10 text-success transition-colors duration-fast"
      : trend === "down"
        ? "bg-destructive/10 text-destructive transition-colors duration-fast"
        : ""
    : "transition-colors duration-base"

  return { trend, isEmphasized, className }
}
