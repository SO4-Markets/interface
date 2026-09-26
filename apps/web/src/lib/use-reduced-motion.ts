import { useEffect, useState } from "react"

/**
 * Hook that detects the system's prefers-reduced-motion preference and updates
 * reactively when the user changes their system settings. SSR-safe: returns false
 * on initial server render, then syncs to the actual preference on mount.
 *
 * Components that need CSS-level motion control should use @media (prefers-reduced-motion)
 * instead. This hook is for components that manage animation timers or canvas rendering
 * that CSS alone cannot stop.
 *
 * @returns true if the user prefers reduced motion
 *
 * @example
 * const reducedMotion = useReducedMotion()
 * useEffect(() => {
 *   if (reducedMotion) {
 *     clearInterval(animationLoop)
 *   }
 * }, [reducedMotion])
 */
export function useReducedMotion(): boolean {
  // Default to false on server render to match initial hydration
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Query the current preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mediaQuery.matches)
    setMounted(true)

    // Listen for changes to the preference
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  // Return false until mounted to ensure hydration matches server render
  return mounted ? reducedMotion : false
}
