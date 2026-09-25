/**
 * Paginated fee/funding history with retained stable-ID pages.
 *
 * Funding history is represented by the same FeeClaim source and can be
 * selected through the optional feeType filter.
 */

import { useInfiniteQuery } from "@tanstack/react-query"
import {
  mergePagesByStableId,
  nextRetainedPrefixSize,
} from "../lib/order-history"
import type { FeeClaim } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { getAccountFeeClaimsPagedDocument } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { queryPolicy } from "@/shared/lib/query-policies"

export const FEE_CLAIMS_PAGE_SIZE = 25

export type UseAccountFeeClaimsResult = {
  data: Array<FeeClaim>
  pageCount: number
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  error: Error | null
  isDisabled: boolean
  fetchNextPage: () => void
}

export function useAccountFeeClaims(
  account: string | null,
  feeType: string | null = null,
): UseAccountFeeClaimsResult {
  const enabled = INDEXER_CONFIG.enabled && !!account
  const document = getAccountFeeClaimsPagedDocument(feeType)

  const query = useInfiniteQuery({
    queryKey: indexerQueryKeys.fees.pages(account ?? "", feeType),
    queryFn: async ({ pageParam, signal }) => {
      if (!enabled || !account) return []

      const result = await executeGraphQLQuery(
        document,
        {
          account,
          first: pageParam,
          offset: 0,
          ...(feeType ? { feeType } : {}),
        },
        { signal },
      )
      return result.feeClaims.nodes
    },
    initialPageParam: FEE_CLAIMS_PAGE_SIZE,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      nextRetainedPrefixSize(
        lastPage.length,
        lastPageParam,
        FEE_CLAIMS_PAGE_SIZE,
      ),
    enabled,
    ...queryPolicy("history"),
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

  const data = mergePagesByStableId(
    query.data?.pages ?? [],
    (claim) => claim.id,
  )

  return {
    data,
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

/** Funding history shares FeeClaim identity/pagination with other fee history. */
export function useAccountFundingHistory(
  account: string | null,
): UseAccountFeeClaimsResult {
  return useAccountFeeClaims(account, "funding")
}
