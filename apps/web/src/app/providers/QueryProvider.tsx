import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useEffect, useRef } from "react"
import type { Query } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { normalizeQueryNetwork } from "@/shared/lib/query-keys"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { boundQueryCache } from "@/features/trade/lib/cache-policy"

function queryClientDefaults() {
  return {
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        meta: { silent: true },
      },
    },
  } as const
}

export function createQueryClient(): QueryClient {
  return new QueryClient(queryClientDefaults())
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return createQueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient()
    boundQueryCache(browserQueryClient)
  }
  return browserQueryClient
}

function isPrivateAccountQuery(
  query: Query,
  account: string,
  network: string,
): boolean {
  const key = query.queryKey
  if (!Array.isArray(key)) return false
  const normNetwork = normalizeQueryNetwork(network)
  const keyNetwork = normalizeQueryNetwork(typeof key[1] === "string" ? key[1] : undefined)

  // Matches any key containing the account address under the relevant network
  const matchesAccount = key.some(
    (segment) => typeof segment === "string" && segment.toLowerCase() === account.toLowerCase(),
  )
  return matchesAccount && keyNetwork === normNetwork
}

export async function clearPrivateAccountQueries(
  queryClient: QueryClient,
  account: string,
  network: string,
): Promise<void> {
  const queryCache = queryClient.getQueryCache()
  const queries = queryCache.getAll()

  for (const query of queries) {
    if (isPrivateAccountQuery(query, account, network)) {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true })
    }
  }
}

function AccountCacheLifecycle() {
  const client = useQueryClient()
  const account = useWalletStore((state) => state.address)
  const network = useWalletStore((state) => state.network)
  const previous = useRef<{ account: string | null; network: string | null }>({
    account,
    network: network ?? null,
  })

  useEffect(() => {
    const old = previous.current
    const accountChanged = old.account !== account
    const networkChanged = old.network !== (network ?? null)

    if (old.account && old.network && (accountChanged || networkChanged)) {
      void clearPrivateAccountQueries(client, old.account, old.network)
    }

    previous.current = { account, network: network ?? null }
  }, [account, client, network])

  return null
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const client =
    typeof window === "undefined" ? createQueryClient() : getQueryClient()

  return (
    <QueryClientProvider client={client}>
      <AccountCacheLifecycle />
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
