/**
 * apps/web/src/lib/graphql/client.ts
 *
 * Typed GraphQL client for SubQuery queries.
 * Integrates with TanStack Query for caching and retry.
 *
 * Usage:
 *   import { executeGraphQLQuery } from "@/lib/graphql/client"
 *   import { GET_MARKETS } from "@/lib/graphql/queries"
 *
 *   const data = await executeGraphQLQuery(GET_MARKETS, {})
 */

import type { TypedDocumentNode } from "@/lib/graphql/queries"
import { INDEXER_CONFIG } from "@/app/config/indexer"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GraphQLError = {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: Array<string | number>
}

export type GraphQLResponse<T> = {
  data?: T
  errors?: Array<GraphQLError>
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a typed GraphQL query against the SubQuery endpoint.
 *
 * @throws Error if indexer is disabled or network request fails
 */
export async function executeGraphQLQuery<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables,
  options: { signal?: AbortSignal } = {},
): Promise<TResult> {
  if (!INDEXER_CONFIG.enabled || !INDEXER_CONFIG.graphqlUrl) {
    throw new Error("Indexer is disabled")
  }

  const response = await fetch(INDEXER_CONFIG.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: document.loc?.source.body ?? "",
      variables: variables ?? {},
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
  }

  const result: GraphQLResponse<TResult> = await response.json()

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`)
  }

  if (!result.data) {
    throw new Error("GraphQL response missing data")
  }

  return result.data
}
