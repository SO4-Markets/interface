/**
 * URL encoding for table sort state (issue 966), so a sorted table survives a
 * reload and can be shared as a link: `?sort=tvl.desc`.
 */
import type { SortState } from "@workspace/ui/components/data-table"

const SORT_PARAM_RE = /^([a-z][a-z0-9-]*)\.(asc|desc)$/

/**
 * Reads a sort param, accepting only columns the table actually sorts by.
 * Anything else — a stale link, a hand-edited URL — is treated as unsorted.
 */
export function parseSortParam(
  value: unknown,
  sortableColumns: ReadonlyArray<string>,
): SortState | null {
  if (typeof value !== "string") return null
  const match = SORT_PARAM_RE.exec(value)
  if (!match) return null
  const [, columnId, direction] = match
  if (!sortableColumns.includes(columnId)) return null
  return { columnId, direction: direction as SortState["direction"] }
}

/** The inverse of {@link parseSortParam}; `undefined` drops the param. */
export function formatSortParam(sort: SortState | null): string | undefined {
  return sort ? `${sort.columnId}.${sort.direction}` : undefined
}

/** `validateSearch` helper: keeps a string param, drops anything else. */
export function optionalSearchString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}
