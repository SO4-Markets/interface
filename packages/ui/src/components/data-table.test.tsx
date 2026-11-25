import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { DataTable, nextSortState, sortRows } from "./data-table"
import type { Column, SortState } from "./data-table"

interface TestRow {
  id: string
  name: string
  value: number
}

const columns: Array<Column<TestRow>> = [
  { id: "name", header: "Name", accessor: (r) => r.name },
  { id: "value", header: "Value", accessor: (r) => r.value, align: "right" },
]

const data: Array<TestRow> = [
  { id: "1", name: "Alpha", value: 100 },
  { id: "2", name: "Beta", value: 200 },
]

describe("DataTable", () => {
  it("renders column headers and data rows", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
      />
    )
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument()
  })

  it("applies right alignment to column header and cells", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
      />
    )
    const th = screen.getByRole("columnheader", { name: "Value" })
    const td = screen.getByRole("cell", { name: "100" })
    expect(th).toHaveClass("text-right")
    expect(td).toHaveClass("text-right")
  })

  it("renders skeleton rows while loading", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading
        loadingLabel="Loading account data…"
        keyExtractor={(r) => r.id}
      />
    )
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBe(columns.length * 3)
    expect(container.querySelector('[role="status"]')).toBeInTheDocument()
    expect(screen.getByText("Loading account data…")).toBeInTheDocument()
  })

  it("supports configurable skeleton row count", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading
        skeletonRows={5}
        keyExtractor={(r) => r.id}
      />
    )
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBe(columns.length * 5)
  })

  it("renders error state with retry recovery action", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={[]}
        error="Unable to connect to indexer"
        onRetry={onRetry}
        retryLabel="Retry loading"
        keyExtractor={(r) => r.id}
      />
    )
    expect(screen.getByText("Unable to connect to indexer")).toBeInTheDocument()
    const retryBtn = screen.getByRole("button", { name: "Retry loading" })
    expect(retryBtn).toBeInTheDocument()
    await user.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("has no accessibility violations while loading or empty", async () => {
    const { container: loadingContainer } = render(
      <DataTable columns={columns} data={[]} isLoading keyExtractor={(r) => r.id} />
    )
    expect(await axe(loadingContainer)).toHaveNoViolations()

    const { container: emptyContainer } = render(
      <DataTable columns={columns} data={[]} emptyMessage="Nothing here" keyExtractor={(r) => r.id} />
    )
    expect(await axe(emptyContainer)).toHaveNoViolations()
  })

  it("renders empty state with message", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No items found"
        keyExtractor={(r) => r.id}
      />
    )
    expect(screen.getByText("No items found")).toBeInTheDocument()
  })

  it("renders empty state with action", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No items"
        emptyAction={<button type="button">Add item</button>}
        keyExtractor={(r) => r.id}
      />
    )
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument()
  })

  it("highlights selected row", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        selectedRowKey="1"
        keyExtractor={(r) => r.id}
      />
    )
    const cells = screen.getAllByRole("cell")
    const alphaCell = cells.find((c) => c.textContent === "Alpha")!
    const row = alphaCell.closest("tr")
    expect(row).toHaveAttribute("aria-current", "true")
    expect(row).toHaveClass("bg-muted/30")
  })

  it("calls onRowClick when a row is clicked", async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={onRowClick}
      />
    )
    await user.click(screen.getByRole("cell", { name: "Alpha" }))
    expect(onRowClick).toHaveBeenCalledWith(data[0])
  })

  it("calls onRowClick when Enter is pressed on a row", async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={onRowClick}
      />
    )
    const cell = screen.getByRole("cell", { name: "Alpha" })
    const row = cell.closest("tr")!
    row.focus()
    await user.keyboard("{Enter}")
    expect(onRowClick).toHaveBeenCalledWith(data[0])
  })

  it("wraps the table in an overflow-x-auto container", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
      />
    )
    const wrapper = container.querySelector('[data-slot="table-container"]')
    expect(wrapper).toHaveClass("overflow-x-auto")
  })

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("DataTable sorting (issue 966)", () => {
  interface SortRow {
    id: string
    name: string
    value: number | null
  }

  const sortColumns: Array<Column<SortRow>> = [
    { id: "name", header: "Name", accessor: (r) => r.name, sortValue: (r) => r.name },
    {
      id: "value",
      header: "Value",
      accessor: (r) => (r.value === null ? "…" : r.value),
      align: "right",
      sortValue: (r) => r.value,
    },
    { id: "note", header: "Note", accessor: () => "-" },
  ]

  const sortData: Array<SortRow> = [
    { id: "b", name: "Beta", value: 20 },
    { id: "x", name: "Pending", value: null },
    { id: "a", name: "alpha", value: 300 },
    { id: "c", name: "Gamma", value: 4 },
  ]

  const ids = (rows: Array<SortRow>) => rows.map((r) => r.id)

  it("cycles unsorted → ascending → descending → unsorted", () => {
    expect(nextSortState(null, "value")).toEqual({ columnId: "value", direction: "asc" })
    expect(nextSortState({ columnId: "value", direction: "asc" }, "value")).toEqual({
      columnId: "value",
      direction: "desc",
    })
    expect(nextSortState({ columnId: "value", direction: "desc" }, "value")).toBeNull()
    expect(nextSortState({ columnId: "name", direction: "desc" }, "value")).toEqual({
      columnId: "value",
      direction: "asc",
    })
  })

  it("sorts numbers numerically and keeps missing values last in both directions", () => {
    expect(ids(sortRows(sortData, sortColumns, { columnId: "value", direction: "asc" }))).toEqual([
      "c", "b", "a", "x",
    ])
    expect(ids(sortRows(sortData, sortColumns, { columnId: "value", direction: "desc" }))).toEqual([
      "a", "b", "c", "x",
    ])
  })

  it("sorts strings case-insensitively and leaves order alone when unsorted", () => {
    expect(ids(sortRows(sortData, sortColumns, { columnId: "name", direction: "asc" }))).toEqual([
      "a", "b", "c", "x",
    ])
    expect(ids(sortRows(sortData, sortColumns, null))).toEqual(ids(sortData))
    expect(ids(sortRows(sortData, sortColumns, { columnId: "note", direction: "asc" }))).toEqual(
      ids(sortData),
    )
  })

  function SortableTable({ initial = null }: { initial?: SortState | null }) {
    const [sort, setSort] = React.useState<SortState | null>(initial)
    return (
      <DataTable
        columns={sortColumns}
        data={sortData}
        keyExtractor={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
      />
    )
  }

  const firstColumn = () =>
    screen.getAllByRole("row").slice(1).map((row) => row.querySelector("td")?.textContent)

  it("exposes aria-sort only on sortable headers and reorders rows on click", async () => {
    const user = userEvent.setup()
    render(<SortableTable />)

    const valueHeader = screen.getByRole("columnheader", { name: "Value" })
    expect(valueHeader).toHaveAttribute("aria-sort", "none")
    expect(screen.getByRole("columnheader", { name: "Note" })).not.toHaveAttribute("aria-sort")

    await user.click(screen.getByRole("button", { name: "Value" }))
    expect(valueHeader).toHaveAttribute("aria-sort", "ascending")
    expect(firstColumn()).toEqual(["Gamma", "Beta", "alpha", "Pending"])

    await user.click(screen.getByRole("button", { name: "Value" }))
    expect(valueHeader).toHaveAttribute("aria-sort", "descending")
    expect(valueHeader.querySelector('[data-slot="sort-indicator"]')).toHaveAttribute(
      "data-direction",
      "desc",
    )
    expect(firstColumn()).toEqual(["alpha", "Beta", "Gamma", "Pending"])

    await user.click(screen.getByRole("button", { name: "Value" }))
    expect(valueHeader).toHaveAttribute("aria-sort", "none")
    expect(firstColumn()).toEqual(["Beta", "Pending", "alpha", "Gamma"])
  })

  it("is keyboard operable", async () => {
    const user = userEvent.setup()
    render(<SortableTable />)
    await user.tab()
    expect(screen.getByRole("button", { name: "Name" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending")
  })

  it("animates the indicator only when motion is allowed", () => {
    render(<SortableTable initial={{ columnId: "name", direction: "desc" }} />)
    const indicator = screen
      .getByRole("columnheader", { name: "Name" })
      .querySelector('[data-slot="sort-indicator"]')
    expect(indicator).toHaveClass("rotate-180", "duration-fast", "motion-reduce:transition-none")
  })

  it("renders plain headers when the table is not sortable", () => {
    render(<DataTable columns={sortColumns} data={sortData} keyExtractor={(r) => r.id} />)
    expect(screen.queryByRole("button", { name: "Value" })).not.toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Value" })).not.toHaveAttribute("aria-sort")
  })

  it("has no accessibility violations when sortable", async () => {
    const { container } = render(<SortableTable initial={{ columnId: "value", direction: "asc" }} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
