import * as React from 'react'

import { cn } from '@workspace/ui/lib/utils'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Button } from '@workspace/ui/components/button'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { useAnimatedRows } from '@workspace/ui/hooks/use-animated-rows'
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeadRow,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

type SortDirection = 'asc' | 'desc'

interface SortState {
  columnId: string
  direction: SortDirection
}

type SortValue = number | string | null | undefined

interface Column<T> {
  id: string
  header: string
  accessor: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
  sticky?: boolean
  /**
   * Makes the column sortable when the table has `onSortChange`. Return the
   * raw value to order by; `null`/`undefined` (unknown, still loading) always
   * sorts last so placeholders never crowd the top of the table.
   */
  sortValue?: (row: T) => SortValue
}

/** Header click cycle: unsorted → ascending → descending → unsorted. */
function nextSortState(current: SortState | null | undefined, columnId: string): SortState | null {
  if (current?.columnId !== columnId) return { columnId, direction: 'asc' }
  if (current.direction === 'asc') return { columnId, direction: 'desc' }
  return null
}

function compareSortValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Stable sort of `rows` by the active column. Rows with no value keep their
 * relative order and stay at the end in both directions.
 */
function sortRows<T>(
  rows: ReadonlyArray<T>,
  columns: ReadonlyArray<Column<T>>,
  sort: SortState | null | undefined,
): Array<T> {
  const column = sort ? columns.find((col) => col.id === sort.columnId) : undefined
  const getValue = column?.sortValue
  if (!sort || !getValue) return [...rows]

  const sign = sort.direction === 'asc' ? 1 : -1
  return rows
    .map((row) => ({ row, value: getValue(row) }))
    .sort((a, b) => {
      const aMissing = a.value == null || Number.isNaN(a.value)
      const bMissing = b.value == null || Number.isNaN(b.value)
      if (aMissing || bMissing) return Number(aMissing) - Number(bMissing)
      return sign * compareSortValues(a.value, b.value)
    })
    .map(({ row }) => row)
}

const ARIA_SORT: Record<SortDirection, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
}

/**
 * Arrow that points up for ascending and turns over for descending. Inactive
 * columns show it faintly so the affordance is discoverable on touch screens,
 * where there is no hover to reveal it.
 */
function SortIndicator({ direction }: { direction: SortDirection | null }) {
  return (
    <svg
      aria-hidden="true"
      data-slot="sort-indicator"
      data-direction={direction ?? 'none'}
      viewBox="0 0 12 12"
      className={cn(
        'size-3 shrink-0 transition-[transform,opacity] duration-fast ease-spring-snappy motion-reduce:transition-none',
        direction === null && 'opacity-30 group-hover:opacity-70',
        direction === 'desc' && 'rotate-180',
      )}
    >
      <path d="M6 2.5v7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  data: Array<T>
  isLoading?: boolean
  loadingLabel?: string
  skeletonRows?: number
  error?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  emptyMessage?: string
  emptyAction?: React.ReactNode
  keyExtractor: (row: T) => string
  ariaLabel?: string
  onRowClick?: (row: T) => void
  selectedRowKey?: string
  /** FLIP insertion/removal/reorder animations for live trading data. */
  animateRows?: boolean
  className?: string
  /** Active sort. Controlled, so callers can persist it (e.g. in the URL). */
  sort?: SortState | null
  /**
   * Enables sortable headers on every column with a `sortValue`. Receives the
   * next state in the unsorted → ascending → descending cycle.
   */
  onSortChange?: (next: SortState | null) => void
}

function DataTable<T>({
  columns,
  data,
  isLoading = false,
  loadingLabel = "Loading data…",
  skeletonRows = 3,
  error,
  onRetry,
  retryLabel = "Try again",
  emptyMessage = 'No data',
  emptyAction,
  keyExtractor,
  onRowClick,
  selectedRowKey,
  animateRows = false,
  className,
  ariaLabel,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const rows = React.useMemo(() => sortRows(data, columns, sort), [data, columns, sort])
  const attachAnimatedRow = useAnimatedRows(rows, keyExtractor, animateRows, isLoading)
  const [scrollTop, setScrollTop] = React.useState(0)
  const virtual = rows.length > 100
  const rowHeight = 46
  const maxRows = 50
  const start = virtual ? Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - 10), rows.length - maxRows) : 0
  const end = virtual ? Math.min(rows.length, start + maxRows) : rows.length
  const stickyClass = (col: Column<T>) => col.sticky
    ? "sticky left-0 z-[1] bg-card shadow-[1px_0_0_var(--border)]"
    : undefined

  if (isLoading) {
    return (
      <Table aria-label={ariaLabel} aria-busy="true" containerClassName={className} data-slot="data-table-loading">
        <TableBody role="status" aria-live="polite">
          <TableRow interactive={false} className="sr-only">
            <TableCell colSpan={columns.length || 1}>{loadingLabel}</TableCell>
          </TableRow>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <TableRow key={i} interactive={false}>
              {columns.map((col) => (
                <TableCell key={col.id} align={col.align} className={cn(col.className, stickyClass(col))}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (error) {
    const colSpan = columns.length || 1
    return (
      <Table aria-label={ariaLabel} containerClassName={className}>
        <TableBody>
          <TableEmptyRow colSpan={colSpan}>
            <EmptyState
              title={typeof error === "string" ? error : "Failed to load data"}
              description="An error occurred while loading this view."
              actions={
                onRetry
                  ? {
                      primary: (
                        <Button size="sm" variant="outline" onClick={onRetry}>
                          {retryLabel}
                        </Button>
                      ),
                    }
                  : undefined
              }
            />
          </TableEmptyRow>
        </TableBody>
      </Table>
    )
  }

  if (data.length === 0) {
    const colSpan = columns.length || 1
    const actionPrimary = emptyAction
      ? emptyAction
      : onRetry
        ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {retryLabel || "Refresh"}
            </Button>
          )
        : undefined

    return (
      <Table aria-label={ariaLabel} containerClassName={className}>
        <TableBody>
          <TableEmptyRow colSpan={colSpan}>
            <EmptyState
              title={emptyMessage}
              actions={actionPrimary ? { primary: actionPrimary } : undefined}
            />
          </TableEmptyRow>
        </TableBody>
      </Table>
    )
  }

  return (
    <Table containerClassName={cn(className, virtual && "max-h-[32rem] overflow-y-auto overscroll-contain")} containerOnScroll={virtual ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined}>
      <TableHeader>
        <TableHeadRow>
          {columns.map((col) => {
            const sortable = Boolean(onSortChange && col.sortValue)
            const direction = sort?.columnId === col.id ? sort.direction : null
            return (
              <TableHead
                key={col.id}
                align={col.align}
                className={col.className}
                aria-sort={sortable ? (direction ? ARIA_SORT[direction] : 'none') : undefined}
              >
                {sortable ? (
                  <button
                    type="button"
                    data-slot="sort-button"
                    onClick={() => onSortChange?.(nextSortState(sort, col.id))}
                    className={cn(
                      'group -mx-1 inline-flex min-h-6 items-center gap-1 rounded-sm px-1 font-medium transition-colors duration-fast hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                      col.align === 'right' && 'flex-row-reverse',
                      direction && 'text-foreground',
                    )}
                  >
                    {col.header}
                    <SortIndicator direction={direction} />
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            )
          })}
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {start > 0 && <TableRow aria-hidden="true" interactive={false}><TableCell colSpan={columns.length} style={{ height: start * rowHeight, padding: 0 }} /></TableRow>}
        {rows.slice(start, end).map((row) => {
          const key = keyExtractor(row)
          const isSelected = selectedRowKey !== undefined && selectedRowKey === key

          return (
            <TableRow
              key={key}
              ref={animateRows ? (node) => attachAnimatedRow(key, node) : undefined}
              interactive={!!onRowClick}
              aria-current={isSelected ? 'true' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-muted/30')}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align}
                  className={cn(col.className, stickyClass(col), isSelected && col.sticky && "bg-muted/30")}
                >
                  {col.accessor(row)}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
        {end < rows.length && <TableRow aria-hidden="true" interactive={false}><TableCell colSpan={columns.length} style={{ height: (rows.length - end) * rowHeight, padding: 0 }} /></TableRow>}
      </TableBody>
    </Table>
  )
}

export { DataTable, nextSortState, sortRows }
export type { Column, DataTableProps, SortDirection, SortState, SortValue }