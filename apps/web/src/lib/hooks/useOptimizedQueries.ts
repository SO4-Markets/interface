import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { UseQueryOptions } from "@tanstack/react-query"

/**
 * Optimized query hook that memoizes query key and options to prevent
 * unnecessary query subscriptions and re-renders when parent components update.
 */
export function useOptimizedQuery<T>(
  queryKey: Array<unknown>,
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  // Memoize the query key to maintain referential equality
  const memoizedKey = useMemo(() => queryKey, [JSON.stringify(queryKey)])

  // Memoize the query function
  const memoizedFn = useCallback(queryFn, [queryFn])

  // Query with memoized dependencies
  return useQuery({
    queryKey: memoizedKey,
    queryFn: memoizedFn,
    ...options,
  })
}

/**
 * Create a selector hook from query data to prevent child component re-renders
 * when only unrelated data changes.
 */
export function createQuerySelector<T, TSelected>(
  selectFn: (data: T | undefined) => TSelected
) {
  return (data: T | undefined) => {
    const selected = useMemo(() => selectFn(data), [data, selectFn])
    return selected
  }
}
