import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/shared/lib/query-keys"

// No aggregate stats endpoint exists yet (verified against
// apps/web/src/lib/graphql/queries.ts — no platform-wide traders/volume/OI
// query). GMX sources these from useTraders/useTotalVolume/usePoolsData
// (landing/src/pages/Home/hooks/*). Every field stays null until SO4 has an
// equivalent, rendering the "-" loading placeholder exactly like GMX's own
// loading state — not a fabricated number. This is a backend gap, not
// something this frontend pass can close; wire it up once the indexer
// exposes the aggregate.

export type LandingStats = {
  traders: number | null
  openInterest: number | null
  totalVolume: number | null
  liquidityTotal: number | null
  loading: boolean
  isStale: boolean
}

interface AggregateStats {
  traders: number | null
  openInterest: number | null
  totalVolume: number | null
  liquidityTotal: number | null
}

/**
 * Fetches aggregate platform statistics with proper caching and freshness handling.
 *
 * - First load shows loading state, then displays data
 * - Background refetch keeps previously loaded data visible
 * - Warm cache reads have no skeleton flash
 * - Stale data is marked so components can show subtle indicators
 *
 * @returns Platform stats with loading/stale indicators
 */
export function useLandingStats(): LandingStats {
  // Cache is kept for 30 seconds; refetch after that to keep data fresh
  // This is separate from staleTime — we show stale data but mark it as such
  const { data, isLoading, isFetching, status } = useQuery<AggregateStats>({
    queryKey: queryKeys.landing.stats(),
    queryFn: async () => {
      // Placeholder: returns null until indexer endpoints are available
      // The query infra is in place for stale-time, cache management, and
      // background refetch without skeleton flash (via isFetching)
      return {
        traders: null,
        openInterest: null,
        totalVolume: null,
        liquidityTotal: null,
      }
    },
    // Keep data in cache for 30 seconds; refetch silently after that
    staleTime: 30 * 1000,
    // Retry once on failure, then show stale data
    retry: 1,
    // Keep data in memory for 5 minutes before removing from cache
    gcTime: 5 * 60 * 1000,
  })

  const isFirstLoad = status === "pending" && isLoading
  const isStale = status === "success" && isFetching

  return {
    traders: data?.traders ?? null,
    openInterest: data?.openInterest ?? null,
    totalVolume: data?.totalVolume ?? null,
    liquidityTotal: data?.liquidityTotal ?? null,
    loading: isFirstLoad,
    isStale,
  }
}
