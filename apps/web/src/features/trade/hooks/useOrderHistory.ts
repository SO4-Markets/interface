/**
 * apps/web/src/features/trade/hooks/useOrderHistory.ts
 *
 * Paged order lifecycle history with fill aggregation (OB-087).
 *
 * Two separate questions, two separate sources:
 *   - Which orders exist, and what happened to them? → paged `orders` read.
 *   - What actually executed? → executed `positionChanges`, aggregated per
 *     order by `buildOrderHistoryRows`.
 *
 * Fills are never paginated inside the same query as the order, because a
 * single order's fills would otherwise be split across pages and its totals
 * would be wrong on every page but one.
 */

import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { toKnownOrderType } from "../lib/order-lifecycle"
import {
  buildOrderHistoryRows,
  dedupeOrderHistoryRows,
  filterOrderHistoryRows,
  mergePagesByStableId,
  nextRetainedPrefixSize,
  normaliseOrderHistoryFilters,
  parseUsdValue,
  toFillRecords,
  toTimestampMillis,
} from "../lib/order-history"
import { useAccountTradeHistory } from "./useAccountTradeHistory"
import type {
  OrderHistoryFilters,
  OrderHistoryRow,
  OrderHistorySource,
} from "../lib/order-history"
import type { Order as IndexedOrder } from "@/lib/graphql/types"
import { executeGraphQLQuery } from "@/lib/graphql/client"
import { getAccountOrdersPagedDocument } from "@/lib/graphql/queries"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { INDEXER_CONFIG } from "@/app/config/indexer"
import { queryPolicy } from "@/shared/lib/query-policies"

export const ORDERS_PAGE_SIZE = 25

export type OrderHistoryTotals = {
  orderCount: number
  filledSizeUsd: number
  remainingSizeUsd: number
  fillCount: number
}

export type UseOrderHistoryResult = {
  /** Filtered rows, newest order first, de-duplicated across pages. */
  rows: Array<OrderHistoryRow>
  totals: OrderHistoryTotals
  pageCount: number
  /** True only while the first page loads; background refetch keeps rows. */
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  error: Error | null
  isDisabled: boolean
  fetchNextPage: () => void
}

const EMPTY_TOTALS: OrderHistoryTotals = {
  orderCount: 0,
  filledSizeUsd: 0,
  remainingSizeUsd: 0,
  fillCount: 0,
}

/** Stable identity so the aggregation memo survives renders with no fills. */
const EMPTY_CHANGES: Parameters<typeof toFillRecords>[0] = []

function toOrderHistorySource(order: IndexedOrder): OrderHistorySource {
  const createdAt = toTimestampMillis(order.createdTimestamp)
  return {
    key: order.key,
    marketKey: order.market.key,
    marketName: order.market.name ?? order.market.key,
    orderType: toKnownOrderType(order.orderType),
    isLong: order.isLong ?? false,
    status: order.status,
    sizeUsd: parseUsdValue(order.sizeDeltaUsd),
    createdAt,
    updatedAt: toTimestampMillis(order.updatedTimestamp) ?? createdAt,
    transactionHash: order.createdTransactionHash,
  }
}

export function useOrderHistory(
  account: string | null,
  filters: OrderHistoryFilters,
): UseOrderHistoryResult {
  const normal = normaliseOrderHistoryFilters(filters)
  const { marketKey, stage, range } = normal
  const document = getAccountOrdersPagedDocument({ marketKey })
  const enabled = INDEXER_CONFIG.enabled && !!account

  const query = useInfiniteQuery({
    queryKey: indexerQueryKeys.orders.history(account ?? "", normal),
    queryFn: async ({ pageParam, signal }) => {
      if (!enabled || !account) return []
      const result = await executeGraphQLQuery(
        document,
        {
          account,
          first: pageParam,
          offset: 0,
          ...(marketKey ? { marketKey } : {}),
        },
        { signal },
      )
      return result.orders.nodes
    },
    initialPageParam: ORDERS_PAGE_SIZE,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      nextRetainedPrefixSize(
        lastPage.length,
        lastPageParam,
        ORDERS_PAGE_SIZE,
      ),
    enabled,
    ...queryPolicy("history"),
  })

  // Fills are read once (newest first) and aggregated per order key, so an
  // order with several fills contributes exactly one filled total.
  const { data: changes = EMPTY_CHANGES } = useAccountTradeHistory(account)

  const pages = query.data?.pages

  const rows = useMemo(
    () => buildRows(pages, changes, marketKey, stage, range),
    [pages, changes, marketKey, stage, range],
  )

  const totals = useMemo(
    () =>
      rows.reduce<OrderHistoryTotals>(
        (accumulator, row) => ({
          orderCount: accumulator.orderCount + 1,
          filledSizeUsd: accumulator.filledSizeUsd + row.filledSizeUsd,
          remainingSizeUsd: accumulator.remainingSizeUsd + row.remainingSizeUsd,
          fillCount: accumulator.fillCount + row.fillCount,
        }),
        { ...EMPTY_TOTALS },
      ),
    [rows],
  )

  if (!INDEXER_CONFIG.enabled) {
    return {
      rows: [],
      totals: { ...EMPTY_TOTALS },
      pageCount: 0,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      isDisabled: true,
      fetchNextPage: () => {},
    }
  }

  return {
    rows,
    totals,
    pageCount: pages?.length ?? 0,
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

function buildRows(
  pages: ReadonlyArray<ReadonlyArray<IndexedOrder>> | undefined,
  changes: Parameters<typeof toFillRecords>[0],
  marketKey: string | null,
  stage: OrderHistoryFilters["stage"],
  range: OrderHistoryFilters["range"],
): Array<OrderHistoryRow> {
  const sources = mergePagesByStableId(
    pages ?? [],
    (order) => order.key,
  ).map(toOrderHistorySource)
  const built = dedupeOrderHistoryRows(
    buildOrderHistoryRows(sources, toFillRecords(changes)),
  )
  return filterOrderHistoryRows(built, { marketKey, stage, range })
}
