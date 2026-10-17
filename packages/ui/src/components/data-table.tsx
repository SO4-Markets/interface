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
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  data: Array<T>
  isLoading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  keyExtractor: (row: T) => string
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
}: DataTableProps<T>) {
  const attachAnimatedRow = useAnimatedRows(data, keyExtractor, animateRows, isLoading)

  if (isLoading) {
    return (
      <Table containerClassName={className}>
        <TableBody>
          {[0, 1, 2].map((i) => (
            <TableRow key={i} interactive={false}>
              {columns.map((col) => (
                <TableCell key={col.id} align={col.align}>
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
      <Table containerClassName={className}>
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
    <Table containerClassName={className}>
      <TableHeader>
        <TableHeadRow>
          {columns.map((col) => (
            <TableHead key={col.id} align={col.align} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
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
                <TableCell key={col.id} align={col.align} className={col.className}>
                  {col.accessor(row)}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export { DataTable }
export type { Column, DataTableProps }
