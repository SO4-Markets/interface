import { useEffect, useRef, useState } from "react"

/**
 * Manages the transition between pending and content states, distinguishing
 * between first load (show skeleton) and background refetch (keep content).
 *
 * This prevents skeleton flashing on warm cache reads while maintaining clear
 * loading indicators for initial data fetches.
 *
 * @param isLoading - Whether data is currently loading
 * @param hasData - Whether any data is available (truthy = has content)
 * @param loadingDelay - Minimum delay before showing loading state (default 300ms)
 *
 * @returns Object with state indicators:
 *   - shouldShowSkeleton: true if skeleton should be displayed
 *   - shouldShowContent: true if content should be displayed
 *   - isFirstLoad: true if this is the initial data load
 */
export function usePendingContent(
  isLoading: boolean,
  hasData: unknown,
  loadingDelay = 300
) {
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(isLoading && !hasData)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hasDataPrevRef = useRef(Boolean(hasData))

  useEffect(() => {
    // Track if we've ever had data (first load is when we go from no data to data)
    if (hasData && !hasDataPrevRef.current) {
      setIsFirstLoad(false)
    }
    hasDataPrevRef.current = Boolean(hasData)
  }, [hasData])

  useEffect(() => {
    if (isLoading) {
      // Only show skeleton if this is first load or we don't have data yet
      if (isFirstLoad || !hasData) {
        // Use a small delay to prevent flickering on fast loads
        loadingTimerRef.current = setTimeout(() => {
          setShouldShowSkeleton(true)
        }, loadingDelay)
      }
    } else {
      // Clear the timer and hide skeleton when not loading
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
      setShouldShowSkeleton(false)
    }

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
    }
  }, [isLoading, isFirstLoad, hasData, loadingDelay])

  return {
    shouldShowSkeleton,
    shouldShowContent: Boolean(hasData) && !shouldShowSkeleton,
    isFirstLoad,
    isLoading,
    hasData: Boolean(hasData),
  }
}
