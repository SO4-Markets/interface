import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { InterruptiblePresence } from "./interruptible-presence"

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
})
