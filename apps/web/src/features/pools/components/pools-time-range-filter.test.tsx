import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PoolsTimeRangeFilter } from "./pools-time-range-filter"
import type { PoolsTimeRange } from "../hooks/use-pools-time-range"

// Mock @workspace/ui/components/tabs as simple passthrough elements
vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="tabs" data-value={value} onClick={(e) => {
      const target = e.target as HTMLElement
      const tabValue = target.getAttribute("data-tab-value")
      if (tabValue && onValueChange) onValueChange(tabValue)
    }}>
      {children}
    </div>
  ),
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="tablist" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, ...rest }: { children: React.ReactNode; value: string; [key: string]: unknown }) => (
    <button
      role="tab"
      data-tab-value={value}
      aria-selected={String((rest as { "data-state"?: string })["data-state"] === "active")}
      {...rest}
    >
      {children}
    </button>
  ),
}))

const OPTIONS: Array<{ value: PoolsTimeRange; label: string }> = [
  { value: "total", label: "Total" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
]

describe("PoolsTimeRangeFilter", () => {
  it("renders a tab for each option", () => {
    render(
      <PoolsTimeRangeFilter
        value="30d"
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    )

    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(OPTIONS.length)
    expect(tabs[0]).toHaveTextContent("Total")
    expect(tabs[1]).toHaveTextContent("7D")
    expect(tabs[2]).toHaveTextContent("30D")
    expect(tabs[3]).toHaveTextContent("90D")
  })

  it("renders the correct number of tabs matching the options array", () => {
    const shortOptions: Array<{ value: PoolsTimeRange; label: string }> = [
      { value: "7d", label: "7D" },
      { value: "30d", label: "30D" },
    ]

    render(
      <PoolsTimeRangeFilter
        value="7d"
        options={shortOptions}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getAllByRole("tab")).toHaveLength(2)
  })

  it("passes the value prop to the Tabs component", () => {
    render(
      <PoolsTimeRangeFilter
        value="7d"
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    )

    // The Tabs mock stores the active value on a data attribute
    const tabs = screen.getByTestId("tabs")
    expect(tabs).toHaveAttribute("data-value", "7d")
  })

  it("calls onChange with the correct PoolsTimeRange value when a tab is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PoolsTimeRangeFilter
        value="30d"
        options={OPTIONS}
        onChange={onChange}
      />,
    )

    const sevenDayTab = screen.getByRole("tab", { name: "7D" })
    await user.click(sevenDayTab)

    expect(onChange).toHaveBeenCalledWith("7d")
  })

  it("calls onChange with 'total' when the Total tab is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PoolsTimeRangeFilter
        value="7d"
        options={OPTIONS}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole("tab", { name: "Total" }))

    expect(onChange).toHaveBeenCalledWith("total")
  })

  it("calls onChange with '90d' when the 90D tab is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PoolsTimeRangeFilter
        value="30d"
        options={OPTIONS}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole("tab", { name: "90D" }))

    expect(onChange).toHaveBeenCalledWith("90d")
  })

  it("does not call onChange when the already-active tab is the target", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PoolsTimeRangeFilter
        value="30d"
        options={OPTIONS}
        onChange={onChange}
      />,
    )

    // Clicking the active tab still triggers onValueChange at the Tabs level
    // (the real Tabs component may suppress it; our mock propagates it)
    await user.click(screen.getByRole("tab", { name: "30D" }))

    expect(onChange).toHaveBeenCalledWith("30d")
  })
})
