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

  browserQueryClient ??= createQueryClient()
  return browserQueryClient
}

function isPrivateAccountQuery(
  query: Query,
  account: string,
  network: string,
): boolean {
  const key = query.queryKey
  return (
    key[0] === "so4" &&
    key[1] === normalizeQueryNetwork(network) &&
    key.some((segment) => segment === account)
  )
}

export async function clearPrivateAccountQueries(
  client: QueryClient,
  account: string,
  network: string,
): Promise<void> {
  const predicate = (query: Query) =>
    isPrivateAccountQuery(query, account, network)

  await client.cancelQueries({ predicate })
  client.removeQueries({ predicate })
}

function AccountCacheLifecycle() {
  const client = useQueryClient()
  const account = useWalletStore((state) => state.address)
  const network = useWalletStore((state) => state.network)
  const previous = useRef({ account, network })

  useEffect(() => {
    const old = previous.current
    const accountChanged = old.account !== account
    const networkChanged = old.network !== network

    if (old.account && old.network && (accountChanged || networkChanged)) {
      void clearPrivateAccountQueries(client, old.account, old.network)
    }

    previous.current = { account, network }
  }, [account, client, network])

  return null
}

// Bound query cache to prevent unbounded growth across long sessions
boundQueryCache(queryClient)

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
