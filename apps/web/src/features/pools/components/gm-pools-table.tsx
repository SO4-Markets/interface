import { useMemo } from 'react'
import {  DataTable } from '@workspace/ui/components/data-table'
import { Numeric } from '@workspace/ui/components/numeric'
import { EmptyState } from '@workspace/ui/components/empty-state'
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
    return <EmptyState title="No pools found" />
  }

  return (
    <div className="w-full overflow-auto overscroll-contain">
      <div className="min-w-[400px]">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          sort={sort}
          onSortChange={onSortChange}
        />
      </div>
    </div>
  )
}
