import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConnectivityStatusBanner } from "./ConnectivityStatusBanner"

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
}

describe("ConnectivityStatusBanner", () => {
  beforeEach(() => {
    vi.useRealTimers()
    setOnline(true)
  })

  it("announces offline state and connection recovery", () => {
    render(<ConnectivityStatusBanner />)

    act(() => window.dispatchEvent(new Event("offline")))
    expect(screen.getByRole("status")).toHaveTextContent(/You’re offline/)
    expect(screen.getByRole("status")).toHaveTextContent(/Transactions are not queued/)

    act(() => window.dispatchEvent(new Event("online")))
    expect(screen.getByRole("status")).toHaveTextContent(/Connection restored/)
    expect(screen.getByRole("status")).toHaveTextContent(/Check transaction activity/)
  })

  it("shows an offline notice when the app starts without connectivity", () => {
    setOnline(false)
    render(<ConnectivityStatusBanner />)

    expect(screen.getByRole("status")).toHaveTextContent(/You’re offline/)
  })

  it("clears the recovery notice after it has been announced", () => {
    vi.useFakeTimers()
    render(<ConnectivityStatusBanner />)
    act(() => window.dispatchEvent(new Event("offline")))
    act(() => window.dispatchEvent(new Event("online")))

    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})