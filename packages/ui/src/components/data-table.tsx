import * as React from 'react'

import { cn } from '@workspace/ui/lib/utils'
import { Skeleton } from '@workspace/ui/components/skeleton'
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

interface Column<T> {
  id: string
  header: string
  accessor: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
  sticky?: boolean
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  data: Array<T>
  isLoading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  keyExtractor: (row: T) => string
  ariaLabel?: string
  onRowClick?: (row: T) => void
  selectedRowKey?: string
  /** FLIP insertion/removal/reorder animations for live trading data. */
  animateRows?: boolean
  className?: string
}

function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data',
  emptyAction,
  keyExtractor,
  onRowClick,
  selectedRowKey,
  animateRows = false,
  className,
  ariaLabel,
}: DataTableProps<T>) {
  const attachAnimatedRow = useAnimatedRows(data, keyExtractor, animateRows, isLoading)
  const [scrollTop, setScrollTop] = React.useState(0)
  const virtual = data.length > 100
  const rowHeight = 46
  const maxRows = 50
  const start = virtual ? Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - 10), data.length - maxRows) : 0
  const end = virtual ? Math.min(data.length, start + maxRows) : data.length
  const stickyClass = (col: Column<T>) => col.sticky
    ? "sticky left-0 z-[1] bg-card shadow-[1px_0_0_var(--border)]"
    : undefined

  if (isLoading) {
    return (
      <Table aria-label={ariaLabel} containerClassName={className}>
        <TableBody>
          {[0, 1, 2].map((i) => (
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

  if (data.length === 0) {
    const colSpan = columns.length || 1
    return (
      <Table aria-label={ariaLabel} containerClassName={className}>
        <TableBody>
          <TableEmptyRow colSpan={colSpan}>
            <EmptyState
              title={emptyMessage}
              actions={emptyAction ? { primary: emptyAction } : undefined}
            />
          </TableEmptyRow>
        </TableBody>
      </Table>
    )
  }

  return (
    <Table
      aria-label={ariaLabel}
      containerClassName={cn(className, virtual && "max-h-[32rem] overflow-y-auto")}
      containerOnScroll={virtual ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined}
    >
      <TableHeader>
        <TableHeadRow>
          {columns.map((col) => (
            <TableHead
              key={col.id}
              align={col.align}
              className={cn(col.className, col.sticky && "sticky left-0 z-[2] bg-muted/25 shadow-[1px_0_0_var(--border)]")}
            >
              {col.header}
            </TableHead>
          ))}
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {start > 0 && <TableRow aria-hidden="true" interactive={false}><TableCell colSpan={columns.length} style={{ height: start * rowHeight, padding: 0 }} /></TableRow>}
        {data.slice(start, end).map((row) => {
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
        {end < data.length && <TableRow aria-hidden="true" interactive={false}><TableCell colSpan={columns.length} style={{ height: (data.length - end) * rowHeight, padding: 0 }} /></TableRow>}
      </TableBody>
    </Table>
  )
}

export { DataTable }
export type { Column, DataTableProps }