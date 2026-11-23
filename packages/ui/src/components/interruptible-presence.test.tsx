import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InterruptiblePresence } from "./interruptible-presence"

afterEach(() => {
  vi.useRealTimers()
  delete document.documentElement.dataset.reducedMotion
})

describe("InterruptiblePresence", () => {
  it("retains an exit and removes interactivity", () => {
    vi.useFakeTimers()
    const { rerender } = render(<InterruptiblePresence present>Panel</InterruptiblePresence>)
    rerender(<InterruptiblePresence present={false} duration={100}>Panel</InterruptiblePresence>)
    expect(screen.getByText("Panel")).toHaveAttribute("data-state", "closed")
    expect(screen.getByText("Panel")).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText("Panel")).toHaveAttribute("inert")
    act(() => vi.advanceTimersByTime(100))
    expect(screen.queryByText("Panel")).toBeNull()
    vi.useRealTimers()
  })

  it("reverses an exit without duplicating the child", () => {
    vi.useFakeTimers()
    const { rerender } = render(<InterruptiblePresence present duration={100}>Panel</InterruptiblePresence>)
    rerender(<InterruptiblePresence present={false} duration={100}>Panel</InterruptiblePresence>)
    rerender(<InterruptiblePresence present duration={100}>Panel</InterruptiblePresence>)
    expect(screen.getAllByText("Panel")).toHaveLength(1)
    expect(screen.getByText("Panel")).toHaveAttribute("data-state", "open")
    vi.useRealTimers()
  })

  it("removes closed content immediately and supports reopening with reduced motion", () => {
    document.documentElement.dataset.reducedMotion = "true"
    const { rerender } = render(<InterruptiblePresence present>Panel</InterruptiblePresence>)
    expect(screen.getByText("Panel")).toHaveAttribute("data-state", "open")

    rerender(<InterruptiblePresence present={false}>Panel</InterruptiblePresence>)
    expect(screen.queryByText("Panel")).toBeNull()

    rerender(<InterruptiblePresence present>Panel</InterruptiblePresence>)
    expect(screen.getByText("Panel")).toHaveAttribute("data-state", "open")

    rerender(<InterruptiblePresence present={false}>Panel</InterruptiblePresence>)
    expect(screen.queryByText("Panel")).toBeNull()
  })
})
