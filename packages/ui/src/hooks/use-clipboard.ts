import { useCallback, useEffect, useRef, useState } from "react"

type ClipboardStatus = "idle" | "copied" | "failed"

type UseClipboardOptions = {
  /** Milliseconds before status resets to idle. @default 2000 */
  resetAfter?: number
}

/** Duration (ms) before the copy status resets to idle. */
const DEFAULT_RESET_DELAY = 2000

export function useClipboard({
  resetAfter = DEFAULT_RESET_DELAY,
}: UseClipboardOptions = {}) {
  const [status, setStatus] = useState<ClipboardStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const operationRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      clearTimer()
      const operation = operationRef.current + 1
      operationRef.current = operation

      try {
        await navigator.clipboard.writeText(text)
        if (operation !== operationRef.current) return false
        setStatus("copied")
        timerRef.current = setTimeout(() => {
          setStatus("idle")
          timerRef.current = null
        }, resetAfter)
        return true
      } catch {
        if (operation !== operationRef.current) return false
        setStatus("failed")
        timerRef.current = setTimeout(() => {
          setStatus("idle")
          timerRef.current = null
        }, resetAfter)
        return false
      }
    },
    [clearTimer, resetAfter]
  )

  useEffect(() => clearTimer, [clearTimer])

  return { status, copy }
}

export type { ClipboardStatus, UseClipboardOptions }
