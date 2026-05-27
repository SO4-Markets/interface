import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { parseSorobanError } from "@/lib/soroban/errors"

function isAuthError(error: unknown): boolean {
  const text = String(error).toLowerCase()
  return ["401", "403", "unauthorized", "unauthenticated"].some((token) => text.includes(token))
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error) {
      if (isAuthError(error)) return
      if (import.meta.env.DEV) console.error("[query error]", error)
      toast.error(parseSorobanError(error))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: true,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
