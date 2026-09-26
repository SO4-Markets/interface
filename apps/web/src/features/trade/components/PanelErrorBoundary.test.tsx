import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PanelErrorBoundary } from "./PanelErrorBoundary"

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom")
  return <div>panel content</div>
}

describe("PanelErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <PanelErrorBoundary panel="chart">
        <Bomb shouldThrow={false} />
      </PanelErrorBoundary>
    )
    expect(screen.getByText("panel content")).toBeInTheDocument()
  })

  it("renders a panel-scoped fallback instead of throwing past the boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <PanelErrorBoundary panel="order book">
        <Bomb shouldThrow />
      </PanelErrorBoundary>
    )

    expect(screen.getByText("Couldn't load the order book")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()

    consoleError.mockRestore()
  })

  it("retry remounts only this panel, without navigating away", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const originalReload = window.location.reload
     
    ;(window.location as any).reload = vi.fn()

    render(
      <PanelErrorBoundary panel="chart">
        <Bomb shouldThrow />
      </PanelErrorBoundary>
    )

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    // Retry re-renders the same subtree fresh (still throws), it must not
    // have called a full page reload.
    expect(window.location.reload).not.toHaveBeenCalled()

    window.location.reload = originalReload
    consoleError.mockRestore()
  })
})
