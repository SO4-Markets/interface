import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { ReactNode } from "react"
import { boundQueryCache, CACHE_POLICIES } from "@/features/trade/lib/cache-policy"

// Background read queries failing (price feeds, contract reads) must NOT show
// "Transaction failed" toasts — those are reserved for write mutations.
// Each hook that needs user-visible error handling does so locally.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_POLICIES.MARKET_DATA.staleTime,
      gcTime: CACHE_POLICIES.MARKET_DATA.gcTime,
      refetchOnWindowFocus: true,
      // Silence console noise in prod; errors are surfaced per-hook as needed
      meta: { silent: true },
    },
  },
})

// Bound query cache to prevent unbounded growth across long sessions
boundQueryCache(queryClient)

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
