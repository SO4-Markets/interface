import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { Numeric } from "@workspace/ui/components/numeric"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { useOrderHistory } from "../../hooks/useOrderHistory"
import { cancelOrder } from "../../lib/stellar"
import {
  DEFAULT_ORDER_HISTORY_FILTERS,
  HISTORY_TIME_RANGE_LABEL
  
  
} from "../../lib/order-history"
import {
  ORDER_LIFECYCLE_BADGE,
  ORDER_LIFECYCLE_LABEL,
  isCancellableStage,
} from "../../lib/order-lifecycle"
import { HistoryFilters } from "./HistoryFilters"
import type {OrderHistoryFilters, OrderHistoryRow} from "../../lib/order-history";
import type { Column } from "@workspace/ui/components/data-table"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

function formatTimestamp(timestamp: number | null): string {
  return timestamp === null ? "-" : new Date(timestamp).toLocaleString()
}

export function OrderHistoryList() {
  const account = useWalletStore((state) => state.address)
  const [filters, setFilters] = useState<OrderHistoryFilters>(DEFAULT_ORDER_HISTORY_FILTERS)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const history = useOrderHistory(account, filters)

  async function handleCancel(row: OrderHistoryRow) {
    if (!account) return
    setCancelling(row.orderKey)
    try {
      await cancelOrder(account, row.orderKey)
    } finally {
      setCancelling(null)
    }
  }

  const columns: Array<Column<OrderHistoryRow>> = [
    {
      id: "market",
      header: "Market",
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{row.marketName}</span>
          <StatusBadge variant={row.isLong ? "success" : "danger"}>
            {row.isLong ? "Long" : "Short"}
          </StatusBadge>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (
        <StatusBadge variant={ORDER_LIFECYCLE_BADGE[row.stage]}>
          {ORDER_LIFECYCLE_LABEL[row.stage]}
        </StatusBadge>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessor: (row) => <span className="text-muted-foreground">{row.orderType}</span>,
    },
    {
      id: "size",
      header: "Original / filled",
      accessor: (row) => (
        <div className="tabular-nums">
          <Numeric value={row.originalSizeUsd} format="usd" />
          <span className="text-muted-foreground"> / </span>
          <Numeric value={row.filledSizeUsd} format="usd" />
        </div>
      ),
    },
    {
      id: "remaining",
      header: "Remaining",
      accessor: (row) => <Numeric value={row.remainingSizeUsd} format="usd" />,
    },
    {
      id: "fills",
      header: "Fills",
      accessor: (row) => <span className="tabular-nums">{row.fillCount}</span>,
    },
    {
      id: "updated",
      header: "Updated",
      accessor: (row) => <span className="text-muted-foreground">{formatTimestamp(row.updatedAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      accessor: (row) =>
        isCancellableStage(row.stage) ? (
          <Button
            size="xs"
            variant="outline"
            pending={cancelling === row.orderKey}
            onClick={() => void handleCancel(row)}
          >
            Cancel
          </Button>
        ) : null,
    },
  ]

  const setFilter = <TKey extends keyof OrderHistoryFilters>(
    key: TKey,
    value: OrderHistoryFilters[TKey],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (history.isDisabled) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">Order history is unavailable while the indexer is disabled.</div>
  }

  return (
    <div>
      <HistoryFilters
        marketKey={filters.marketKey}
        range={filters.range}
        stage={filters.stage}
        onMarketChange={(value) => setFilter("marketKey", value)}
        onRangeChange={(value) => setFilter("range", value)}
        onStageChange={(value) => setFilter("stage", value as OrderHistoryFilters["stage"])}
      />
      {history.error && (
        <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          Unable to load order history. Try again shortly.
        </p>
      )}
      <DataTable
        columns={columns}
        data={history.rows}
        isLoading={history.isLoading}
        emptyMessage={history.error ? "Order history unavailable" : `No orders in ${HISTORY_TIME_RANGE_LABEL[filters.range].toLowerCase()}`}
        keyExtractor={(row) => row.rowKey}
      />
      {history.hasNextPage && (
        <div className="flex justify-center border-t border-border p-3">
          <Button
            size="sm"
            variant="outline"
            pending={history.isFetchingNextPage}
            onClick={history.fetchNextPage}
          >
            Load older orders
          </Button>
        </div>
      )}
    </div>
  )
}
