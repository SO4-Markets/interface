import { useMemo } from 'react'
import { DataTable } from '@workspace/ui/components/data-table'
import { Numeric } from '@workspace/ui/components/numeric'
import { EmptyState, LoadingCardsState } from '@workspace/ui/components/states'
import type { Column, SortState } from '@workspace/ui/components/data-table'
import type { PoolMarketConfig } from '../data/markets'

export interface Pool {
  id: string
  name: string
  tvl: string
  apr: string
}

export interface GmPoolsTableProps {
  isLoading?: boolean
  pools?: Array<Pool>
  markets?: Array<PoolMarketConfig>
  /** Controlled sort; pass `onSortChange` to make the headers sortable (issue 966). */
  sort?: SortState | null
  onSortChange?: (next: SortState | null) => void
}

/** Columns the GM pools table can be ordered by, used to validate `?sort=`. */
export const GM_POOL_SORT_COLUMNS = ['pool', 'tvl', 'apr'] as const

/** Loading placeholders ('...') have no value and sort last. */
function sortableNumber(value: string): number | null {
  return value === '...' ? null : parseNumericString(value)
}

function parseNumericString(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

export function GmPoolsTable({ isLoading, pools, markets, sort, onSortChange }: GmPoolsTableProps) {
  const data = useMemo(() => {
    if (isLoading) return []
    return pools || (markets ? markets.map(m => ({
      id: m.marketToken,
      name: m.displayName,
      tvl: '...',
      apr: '...'
    })) : [])
  }, [isLoading, pools, markets])

  const columns: Array<Column<Pool>> = useMemo(() => [
    {
      id: 'pool',
      header: 'Pool',
      accessor: (row) => <span>{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'tvl',
      header: 'TVL',
      accessor: (row) => {
        if (row.tvl === '...') return <span>...</span>
        const num = parseNumericString(row.tvl)
        if (num !== null) return <Numeric value={num} format="usd" compact />
        return <span>{row.tvl}</span>
      },
      sortValue: (row) => sortableNumber(row.tvl),
    },
    {
      id: 'apr',
      header: 'APR',
      accessor: (row) => {
        if (row.apr === '...') return <span>...</span>
        const num = parseNumericString(row.apr)
        if (num !== null) return <Numeric value={num} format="pct" />
        return <span>{row.apr}</span>
      },
      sortValue: (row) => sortableNumber(row.apr),
    },
  ], [])

  if (!isLoading && data.length === 0) {
    return <EmptyState title="No pools found" description="No liquidity pools matched your criteria." />
  }

  return (
    <div className="w-full">
      {/* Mobile responsive card list: preserves labels, values, and screen-reader relationships */}
      <div className="space-y-2 p-3 md:hidden" role="list" aria-label="Liquidity pools">
        {isLoading ? (
          <LoadingCardsState count={3} label="Loading liquidity pools…" />
        ) : (
          data.map((row) => {
            const tvlNum = row.tvl === '...' ? null : parseNumericString(row.tvl)
            const aprNum = row.apr === '...' ? null : parseNumericString(row.apr)

            return (
              <div
                key={row.id}
                role="listitem"
                className="rounded-lg border border-border bg-card px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{row.name}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">TVL</dt>
                    <dd className="font-mono tabular-nums text-foreground">
                      {row.tvl === '...' ? '...' : tvlNum !== null ? <Numeric value={tvlNum} format="usd" compact /> : row.tvl}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">APR</dt>
                    <dd className="font-mono tabular-nums text-foreground">
                      {row.apr === '...' ? '...' : aprNum !== null ? <Numeric value={aprNum} format="pct" /> : row.apr}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop data table */}
      <div className="hidden md:block w-full overflow-auto overscroll-contain">
        <div className="min-w-[400px]">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            ariaLabel="Liquidity pools"
            keyExtractor={(row) => row.id}
            sort={sort}
            onSortChange={onSortChange}
          />
        </div>
      </div>
    </div>
  )
}
