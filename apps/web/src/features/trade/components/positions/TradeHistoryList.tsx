import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { Numeric } from "@workspace/ui/components/numeric"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { EmptyState, LoadingCardsState } from "@workspace/ui/components/states"
import { useAccountFillPages } from "../../hooks/useAccountFillPages"
import {
  DEFAULT_FILL_FILTERS,
  HISTORY_TIME_RANGE_LABEL,
  filterFills
} from "../../lib/order-history"
import { HistoryFilters } from "./HistoryFilters"
import { AccountOrderCard } from "./AccountRowDetails"
import type { FillFilters, FillRecord } from "../../lib/order-history"
import type { Column } from "@workspace/ui/components/data-table"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { RelativeTime } from "@/shared/components/RelativeTime"

export function TradeHistoryList() {
  const account = useWalletStore((state) => state.address)
  const [filters, setFilters] = useState<FillFilters>(DEFAULT_FILL_FILTERS)
  const history = useAccountFillPages(account, filters)
  const rows = useMemo(() => filterFills(history.data, filters), [history.data, filters])

  const columns: Array<Column<FillRecord>> = [
    {
      id: "market",
      header: "Market",
      sticky: true,
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
      id: "side",
      header: "Side",
      accessor: (row) => <span className="text-muted-foreground">{row.changeType}</span>,
    },
    {
      id: "size",
      header: "Executed size",
      accessor: (row) => <Numeric value={row.sizeUsd} format="usd" />,
    },
    {
      id: "price",
      header: "Execution price",
      accessor: (row) => <Numeric value={row.executionPriceUsd} format="usd" />,
    },
    {
      id: "fee",
      header: "Fee",
      accessor: (row) => <Numeric value={row.positionFeeUsd} format="usd" />,
    },
    {
      id: "time",
      header: "Executed",
      accessor: (row) => <RelativeTime className="text-muted-foreground" value={row.timestamp} />,
    },
  ]

  const setFilter = <TKey extends keyof FillFilters>(
    key: TKey,
    value: FillFilters[TKey],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (history.isDisabled) {
    return (
      <EmptyState
        title="Trade history unavailable"
        description="Trade history is unavailable while the indexer is disabled."
      />
    )
  }

  return (
    <div>
      <HistoryFilters
        marketKey={filters.marketKey}
        range={filters.range}
        onMarketChange={(value) => setFilter("marketKey", value)}
        onRangeChange={(value) => setFilter("range", value)}
      />
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span>{rows.length} executed {rows.length === 1 ? "fill" : "fills"}</span>
        <label className="flex items-center gap-2">
          Side
          <select
            aria-label="Fill side filter"
            className="h-11 rounded-md border border-border bg-background px-2 text-xs text-foreground sm:h-7"
            value={filters.side}
            onChange={(event) => setFilter("side", event.target.value as FillFilters["side"])}
          >
            <option value="all">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
      </div>
      {history.error && (
        <p role="alert" className="border-y border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          Unable to load executed fills. Try again shortly.
        </p>
      )}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={rows}
          ariaLabel="Trade history"
          animateRows
          isLoading={history.isLoading}
          error={history.error ? "Trade history unavailable" : undefined}
          onRetry={history.refetch ? () => history.refetch() : undefined}
          emptyMessage={history.error ? "Trade history unavailable" : `No executed fills in ${HISTORY_TIME_RANGE_LABEL[filters.range].toLowerCase()}`}
          keyExtractor={(row) => row.id}
        />
      </div>
      {/* Narrow-screen cards mirror the table with identical labels and values (OB-090). */}
      <div className="space-y-2 p-3 md:hidden" role="list" aria-label="Trade history">
        {history.isLoading ? (
          <LoadingCardsState count={3} label="Loading trade history…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title={history.error ? "Trade history unavailable" : `No executed fills in ${HISTORY_TIME_RANGE_LABEL[filters.range].toLowerCase()}`}
            description={history.error ? "Unable to load trade history at this time." : "Fills will appear here once executed."}
            actions={
              history.error && history.refetch
                ? {
                    primary: (
                      <Button size="sm" variant="outline" onClick={() => history.refetch?.()}>
                        Try again
                      </Button>
                    ),
                  }
                : undefined
            }
          />
        ) : (
          rows.map((row) => (
            <div key={row.id} role="listitem">
              <AccountOrderCard
                rowKey={row.id}
                marketName={row.marketName}
                sideBadge={{ label: row.isLong ? "Long" : "Short", variant: row.isLong ? "success" : "danger" }}
                summarySizeUsd={row.sizeUsd}
                fields={[
                  { label: "Side", value: <span className="text-muted-foreground">{row.changeType}</span> },
                  { label: "Executed size", value: <Numeric value={row.sizeUsd} format="usd" /> },
                  { label: "Execution price", value: <Numeric value={row.executionPriceUsd} format="usd" /> },
                  { label: "Fee", value: <Numeric value={row.positionFeeUsd} format="usd" /> },
                  { label: "Executed", value: <RelativeTime className="text-muted-foreground" value={row.timestamp} /> },
                ]}
                actions={[]}
              />
            </div>
          ))
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
            Load older fills
          </Button>
        </div>
      )}
    </div>
  )
}
