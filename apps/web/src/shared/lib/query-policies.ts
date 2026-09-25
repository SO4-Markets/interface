export type QueryDataClass =
  | "metadata"
  | "prices-depth"
  | "balances"
  | "positions"
  | "history"

export type QueryPolicy = {
  staleTime: number
  gcTime: number
  retry: number | boolean
  refetchOnWindowFocus: boolean
  refetchOnReconnect: boolean
  refetchInterval: number | false
}

export const QUERY_POLICY_TABLE: Record<QueryDataClass, QueryPolicy> = {
  metadata: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
  "prices-depth": {
    staleTime: 2_000,
    gcTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
  balances: {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
  positions: {
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
  history: {
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    retry: 3,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: false,
  },
}

export type QueryPolicyContext = {
  visible?: boolean
  streaming?: boolean
  fallbackPollMs?: number
}

export function queryPolicy(
  dataClass: QueryDataClass,
  context: QueryPolicyContext = {},
): QueryPolicy {
  const base = QUERY_POLICY_TABLE[dataClass]
  if (dataClass !== "prices-depth") return { ...base }

  const visible = context.visible ?? true
  const streaming = context.streaming ?? false
  return {
    ...base,
    refetchInterval:
      visible && !streaming
        ? (context.fallbackPollMs ?? 5_000)
        : false,
  }
}
