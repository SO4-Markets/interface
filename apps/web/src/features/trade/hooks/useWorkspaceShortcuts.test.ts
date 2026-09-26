import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useWorkspaceShortcuts } from "./useWorkspaceShortcuts"
import { clearShortcutRegistry } from "@/lib/use-keyboard-shortcut"

describe("useWorkspaceShortcuts", () => {
  beforeEach(() => {
    clearShortcutRegistry()
  })

  it("sets up market search shortcut", () => {
    const onFocusMarketSearch = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusMarketSearch,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "m",
      ctrlKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusMarketSearch).toHaveBeenCalledOnce()
  })

  it("sets up chart focus shortcut (Ctrl+1)", () => {
    const onFocusChart = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusChart,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "1",
      ctrlKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusChart).toHaveBeenCalledOnce()
  })

  it("sets up book focus shortcut (Ctrl+2)", () => {
    const onFocusBook = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusBook,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "2",
      ctrlKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusBook).toHaveBeenCalledOnce()
  })

  it("sets up trade panel focus shortcut (Ctrl+3)", () => {
    const onFocusTrade = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusTrade,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "3",
      ctrlKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusTrade).toHaveBeenCalledOnce()
  })

  it("sets up positions focus shortcut (Ctrl+4)", () => {
    const onFocusPositions = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusPositions,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "4",
      ctrlKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusPositions).toHaveBeenCalledOnce()
  })

  it("handles partial configuration", () => {
    const onFocusChart = vi.fn()
    const onFocusTrade = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusChart,
        onFocusTrade,
      })
    )

    const chartEvent = new KeyboardEvent("keydown", {
      key: "1",
      ctrlKey: true,
    })
    window.dispatchEvent(chartEvent)

    const tradeEvent = new KeyboardEvent("keydown", {
      key: "3",
      ctrlKey: true,
    })
    window.dispatchEvent(tradeEvent)

    expect(onFocusChart).toHaveBeenCalledOnce()
    expect(onFocusTrade).toHaveBeenCalledOnce()
  })

  it("works with Cmd modifier on Mac", () => {
    const onFocusMarketSearch = vi.fn()
    renderHook(() =>
      useWorkspaceShortcuts({
        onFocusMarketSearch,
      })
    )

    const event = new KeyboardEvent("keydown", {
      key: "m",
      metaKey: true,
    })
    window.dispatchEvent(event)

    expect(onFocusMarketSearch).toHaveBeenCalledOnce()
  })
})
