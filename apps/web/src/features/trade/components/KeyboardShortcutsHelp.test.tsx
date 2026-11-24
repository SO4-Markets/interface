import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearShortcutRegistry, registerShortcut } from "@/lib/use-keyboard-shortcut"
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp"

describe("KeyboardShortcutsHelp (#1055)", () => {
  beforeEach(() => {
    clearShortcutRegistry()
    registerShortcut("Ctrl+1", { description: "Focus the chart panel from anywhere in the workspace" })
  })

  afterEach(() => cleanup())

  it("renders its trigger in flow so it cannot float over panel controls", () => {
    render(<KeyboardShortcutsHelp />)
    const trigger = screen.getByRole("button", { name: "Help" })

    // The fixed trigger covered the OHLC toggle (phone), the Positions tab
    // (tablet), and Reset layout (desktop).
    expect(trigger.className).not.toMatch(/\bfixed\b|\bbottom-/)
    expect(trigger).toHaveClass("touch-target")
    expect(trigger).toHaveAttribute("data-tour-help-trigger")
  })

  it("lists shortcuts with full, wrapping descriptions", () => {
    render(<KeyboardShortcutsHelp />)
    fireEvent.click(screen.getByRole("button", { name: "Help" }))

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" })
    const description = within(dialog).getByText("Focus the chart panel from anywhere in the workspace")
    expect(description).not.toHaveClass("truncate")
    expect(description).toHaveClass("break-words")
    expect(within(dialog).getByText("Ctrl")).toBeInTheDocument()

    // Rows are spaced inside the scrolling viewport, not on its wrapper.
    const viewport = dialog.querySelector("[data-slot='scroll-area-viewport']")
    expect(viewport).toHaveClass("space-y-2")
    expect(viewport).toContainElement(description)
  })
})
