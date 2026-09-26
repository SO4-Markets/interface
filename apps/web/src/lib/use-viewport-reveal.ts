import { useEffect, useRef } from "react"

type UseViewportRevealOptions = {
  /** Once per session or per page load */
  once?: boolean
  /** Threshold (0-1) when observer fires */
  threshold?: number | Array<number>
  /** Callback when element enters viewport */
  onReveal?: () => void
}

/**
 * Hook for viewport-based reveals. Triggers a callback when an element enters
 * the viewport, respecting reduced-motion preferences. Cleans up observer
 * automatically on unmount.
 */
export function useViewportReveal(options: UseViewportRevealOptions = {}) {
  const { once = true, threshold = 0.1, onReveal } = options
  const ref = useRef<HTMLDivElement>(null)
  const hasRevealed = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (!once || !hasRevealed.current)) {
            hasRevealed.current = true
            onReveal?.()
            if (once) observer.unobserve(element)
          }
        })
      },
      { threshold }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [once, threshold, onReveal])

  return ref
}
