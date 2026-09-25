/**
 * apps/web/src/features/trade/hooks/useAccountFillPages.ts
 *
 * Paginated executed-fill history (OB-087).
 *
 * `useInfiniteQuery` keeps every page it has loaded, so appending the next page
 * of fills never discards the older pages already on screen. `maxPages` is
 * deliberately not set: capping pages would drop older loaded pages on the next
 * refresh, which is exactly what the acceptance criteria forbid.
 */

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import {
  dedupeById,
  filterFills,
  flattenPages,
  hasMorePages,
  nextOffset,
  normaliseFillFilters,
  toFillRecords,
} from "../lib/order-history"
import type { FillFilters, FillRecord } from "../lib/order-history"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { getAccountPositionChangesPagedDocument } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"

export const FILLS_PAGE_SIZE = 25

export type UseAccountFillPagesResult = {
  /** Every loaded page, de-duplicated across page boundaries. */
  data: Array<FillRecord>
  /** Number of pages currently loaded. */
  pageCount: number
  /** True only while the first page is loading (never during background refetch). */
  isLoading: boolean
  /** True while appending a page, so the existing rows stay visible. */
  isFetchingNextPage: boolean
  hasNextPage: boolean
  error: Error | null
  isDisabled: boolean
  fetchNextPage: () => void
}

export function useAccountFillPages(
  account: string | null,
  filters: FillFilters,
): UseAccountFillPagesResult {
  const normal = normaliseFillFilters(filters)
  const document = getAccountPositionChangesPagedDocument({
    marketKey: normal.marketKey,
  })
  const enabled = INDEXER_CONFIG.enabled && !!account

  const query = useInfiniteQuery({
    queryKey: indexerQueryKeys.tradeHistory.pages(account ?? "", normal),
    queryFn: async ({ pageParam, signal }) => {
      if (!enabled || !account) return []
      const result = await executeGraphQLQuery(
        document,
        {
          account,
          first: FILLS_PAGE_SIZE,
          offset: pageParam,
          ...(normal.marketKey ? { marketKey: normal.marketKey } : {}),
        },
        { signal },
      )
      return result.positionChanges.nodes
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      hasMorePages(lastPage.length, FILLS_PAGE_SIZE)
        ? nextOffset(allPages, FILLS_PAGE_SIZE)
        : undefined,
    enabled,
    // Keep the previous filter's rows on screen while the new filter loads, so
    // switching filters does not collapse the table to an empty state.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 3,
  })

  if (!INDEXER_CONFIG.enabled) {
    return {
      data: [],
      pageCount: 0,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      isDisabled: true,
      fetchNextPage: () => {},
    }
  }

  const changes = flattenPages(query.data?.pages ?? [])
  const fills = filterFills(dedupeById(toFillRecords(changes)), normal)

  return {
    data: fills,
    pageCount: query.data?.pages.length ?? 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
    isDisabled: false,
    fetchNextPage: () => {
      void query.fetchNextPage()
    },
  }
}
