import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { Numeric } from "@workspace/ui/components/numeric"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { useOrderHistory } from "../../hooks/useOrderHistory"
import { amendOrderViaReplace, cancelOrder } from "../../lib/stellar"
import {
  DEFAULT_ORDER_HISTORY_FILTERS,
  HISTORY_TIME_RANGE_LABEL,
  type OrderHistoryFilters,
  type OrderHistoryRow,
} from "../../lib/order-history"
import {
  isCancellableStage,
  ORDER_LIFECYCLE_BADGE,
  ORDER_LIFECYCLE_LABEL,
} from "../../lib/order-lifecycle"
import { getOrderAmendCapability, type AmendPayload, type AmendReplaceOutcome } from "../../lib/order-amendment"
import { AmendOrderDialog, type AmendTarget } from "./AmendOrderDialog"
import { AccountOrderCard } from "./AccountRowDetails"
import { HistoryFilters } from "./HistoryFilters"
import type { Column } from "@workspace/ui/components/data-table"
import type { OrderType } from "../../hooks/useOrders"

function formatTimestamp(timestamp: number | null): string {
  return timestamp === null ? "-" : new Date(timestamp).toLocaleString()
}

function toAmendTarget(row: OrderHistoryRow): AmendTarget {
  return {
    orderKey: row.orderKey,
    marketName: row.marketName,
    orderType: row.orderType as OrderType,
    isLong: row.isLong,
    triggerPrice: 0,
    remainingSizeUsd: row.remainingSizeUsd,
    filledSizeUsd: row.filledSizeUsd,
    stage: row.stage,
  }
}

export function OrderHistoryList() {
  const account = useWalletStore((state) => state.address)
  const [filters, setFilters] = useState<OrderHistoryFilters>(DEFAULT_ORDER_HISTORY_FILTERS)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [amending, setAmending] = useState<OrderHistoryRow | null>(null)
  const [amendError, setAmendError] = useState<string | null>(null)
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

  async function handleAmend(payload: AmendPayload): Promise<AmendReplaceOutcome> {
    if (!account || !amending) throw new Error("No order selected for amendment.")
    const row = amending
    setAmendError(null)
    // History rows do not carry the full original order (collateral, trigger);
    // size-only replacement preserves the economics while trigger edits stay
    // in the open-orders table where the original trigger is known.
    const outcome = await amendOrderViaReplace(
      account,
      {
        orderKey: row.orderKey,
        marketAddress: row.marketKey,
        collateralToken: "",
        orderType: row.orderType as OrderType,
        isLong: row.isLong,
        acceptablePrice: 0,
        triggerPrice: 0,
        positionKey: null,
        remainingSizeUsd: row.remainingSizeUsd,
        filledSizeUsd: row.filledSizeUsd,
        stage: row.stage,
      },
      { sizeUsd: payload.sizeUsd },
    )
    if (outcome.status === "replace-failed") {
      setAmending(null)
      setAmendError(
        `Order cancelled, but the replacement failed: ${outcome.error}. The original is no longer live — place a new order manually.`,
      )
    }
    return outcome
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
      accessor: (row) => {
        if (!isCancellableStage(row.stage)) return null
        const capability = getOrderAmendCapability({ orderType: row.orderType, stage: row.stage })
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={!capability.canAmend}
              title={capability.canAmend ? "Amend size via cancel-and-replace (loses queue priority)" : (capability.reason ?? "Cannot amend")}
              aria-label={capability.canAmend ? `Amend ${row.marketName} order` : `Amend unavailable: ${capability.reason ?? "unsupported"}`}
              onClick={() => {
                setAmendError(null)
                setAmending(row)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="outline"
              pending={cancelling === row.orderKey}
              onClick={() => void handleCancel(row)}
            >
              Cancel
            </Button>
          </div>
        )
      },
    },
  ]

  const setFilter = <K extends keyof OrderHistoryFilters>(key: K, value: OrderHistoryFilters[K]) => {
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
      {amendError && (
        <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {amendError}
        </p>
      )}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={history.rows}
          isLoading={history.isLoading}
          emptyMessage={history.error ? "Order history unavailable" : `No orders in ${HISTORY_TIME_RANGE_LABEL[filters.range].toLowerCase()}`}
          keyExtractor={(row) => row.rowKey}
        />
      </div>
      {/* Narrow-screen cards mirror the table with identical labels and actions (OB-090). */}
      <div className="space-y-2 p-3 md:hidden" role="list" aria-label="Order history">
        {history.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading order history…</p>
        ) : history.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {history.error ? "Order history unavailable" : `No orders in ${HISTORY_TIME_RANGE_LABEL[filters.range].toLowerCase()}`}
          </p>
        ) : (
          history.rows.map((row) => {
            const capability = getOrderAmendCapability({ orderType: row.orderType, stage: row.stage })
            const cancellable = isCancellableStage(row.stage)
            return (
              <div key={row.rowKey} role="listitem">
                <AccountOrderCard
                  rowKey={row.rowKey}
                  marketName={row.marketName}
                  sideBadge={{ label: row.isLong ? "Long" : "Short", variant: row.isLong ? "success" : "danger" }}
                  statusBadge={{ label: ORDER_LIFECYCLE_LABEL[row.stage], variant: ORDER_LIFECYCLE_BADGE[row.stage] }}
                  summarySizeUsd={row.remainingSizeUsd}
                  fields={[
                    { label: "Status", value: <span>{ORDER_LIFECYCLE_LABEL[row.stage]}</span> },
                    { label: "Type", value: <span className="text-muted-foreground">{row.orderType}</span> },
                    {
                      label: "Original / filled",
                      value: (
                        <span className="tabular-nums">
                          <Numeric value={row.originalSizeUsd} format="usd" />
                          <span className="text-muted-foreground"> / </span>
                          <Numeric value={row.filledSizeUsd} format="usd" />
                        </span>
                      ),
                    },
                    { label: "Remaining", value: <Numeric value={row.remainingSizeUsd} format="usd" /> },
                    { label: "Fills", value: <span className="tabular-nums">{row.fillCount}</span> },
                    { label: "Updated", value: <span className="text-muted-foreground">{formatTimestamp(row.updatedAt)}</span> },
                  ]}
                  actions={
                    cancellable
                      ? [
                          {
                            label: "Edit",
                            disabled: !capability.canAmend,
                            disabledReason: capability.reason ?? "Unsupported",
                            onClick: () => {
                              setAmendError(null)
                              setAmending(row)
                            },
                          },
                          {
                            label: "Cancel",
                            pending: cancelling === row.orderKey,
                            onClick: () => void handleCancel(row),
                          },
                        ]
                      : []
                  }
                />
              </div>
            )
          })
        )}
      </div>
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
      <AmendOrderDialog
        order={amending ? toAmendTarget(amending) : null}
        open={amending !== null}
        onClose={() => setAmending(null)}
        onSubmit={handleAmend}
        sizeOnly
      />
    </div>
  )
}
