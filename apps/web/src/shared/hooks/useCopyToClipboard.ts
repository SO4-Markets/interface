import { useCallback, useEffect, useRef, useState } from "react"

type UseCopyToClipboardOptions = {
  resetAfter?: number
}

export function useCopyToClipboard({
  resetAfter = 2000,
}: UseCopyToClipboardOptions = {}) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResetTimer = useCallback(() => {
    if (!resetTimerRef.current) return
    clearTimeout(resetTimerRef.current)
    resetTimerRef.current = null
  }, [])

  const copyToClipboard = useCallback(
    async (text: string) => {
      clearResetTimer()

      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        resetTimerRef.current = setTimeout(() => {
          setCopied(false)
          resetTimerRef.current = null
        }, resetAfter)
        return true
      } catch {
        setCopied(false)
        return false
      }
    },
    [clearResetTimer, resetAfter],
  )

  useEffect(() => clearResetTimer, [clearResetTimer])

  return { copied, copyToClipboard }
}
