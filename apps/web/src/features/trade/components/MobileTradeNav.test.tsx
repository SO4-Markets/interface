import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MobileTradeNav, mobileViewClassName } from "./MobileTradeNav"

describe("MobileTradeNav", () => {
  it("marks the active tab as selected", () => {
    render(<MobileTradeNav active="chart" onChange={vi.fn()} />)
    expect(screen.getByRole("tab", { name: "Chart" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Trade" })).toHaveAttribute("aria-selected", "false")
  })

  it("calls onChange with the tapped view", () => {
    const onChange = vi.fn()
    render(<MobileTradeNav active="chart" onChange={onChange} />)
    fireEvent.click(screen.getByRole("tab", { name: "Positions" }))
    expect(onChange).toHaveBeenCalledWith("positions")
  })

  it("renders all four trading views", () => {
    render(<MobileTradeNav active="trade" onChange={vi.fn()} />)
    expect(screen.getAllByRole("tab")).toHaveLength(4)
  })
})

describe("mobileViewClassName", () => {
  it("keeps the active view visible below lg", () => {
    expect(mobileViewClassName("chart", "chart")).not.toContain("hidden")
  })

  it("hides inactive views below lg without unmounting the caller's tree", () => {
    expect(mobileViewClassName("trade", "chart")).toContain("hidden")
  })

  it("always shows every view at lg and up, regardless of the mobile tab", () => {
    expect(mobileViewClassName("chart", "trade")).toContain("lg:flex")
    expect(mobileViewClassName("trade", "chart")).toContain("lg:flex")
    expect(mobileViewClassName("positions", "chart")).toContain("lg:flex")
  })
})
