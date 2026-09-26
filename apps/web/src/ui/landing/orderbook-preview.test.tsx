import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OrderbookPreview } from "./orderbook-preview"
import type { ComponentProps } from "react"


vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}))

function stubMotionPreference(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

/** The book rows in DOM order, so a tick is observable as a reordering. */
function visiblePrices(container: HTMLElement): Array<string> {
  return Array.from(container.querySelectorAll("li")).map(
    (row) => row.querySelector("span")?.textContent ?? ""
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("OrderbookPreview", () => {
  it("labels the sample numbers so they cannot pass for live liquidity", () => {
    stubMotionPreference(false)
    render(<OrderbookPreview />)

    expect(screen.getByText(/Sample data/i)).toHaveTextContent(/not live liquidity/i)
    expect(screen.getByLabelText(/not live market data/i)).toBeInTheDocument()
  })

  it("sends the reader to the real trade route, not to a mock screen", () => {
    stubMotionPreference(false)
    render(<OrderbookPreview />)

    const callToAction = screen.getByRole("link", { name: /live order book/i })
    expect(callToAction).toHaveAttribute("href", "/trade")
  })

  it("renders a static book under reduced motion", () => {
    vi.useFakeTimers()
    stubMotionPreference(true)
    const { container } = render(<OrderbookPreview />)

    const before = visiblePrices(container)
    expect(before).toHaveLength(4)

    act(() => vi.advanceTimersByTime(12_000))

    expect(visiblePrices(container)).toEqual(before)
  })

  it("ticks while the panel is on screen and stops once the page is hidden", () => {
    vi.useFakeTimers()
    stubMotionPreference(false)
    const { container } = render(<OrderbookPreview />)

    const atStart = visiblePrices(container)
    act(() => vi.advanceTimersByTime(3_000))
    const afterOneTick = visiblePrices(container)
    expect(afterOneTick).not.toEqual(atStart)
    expect(afterOneTick.slice().sort()).toEqual(atStart.slice().sort())

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    const whenHidden = visiblePrices(container)
    act(() => vi.advanceTimersByTime(12_000))

    expect(visiblePrices(container)).toEqual(whenHidden)
  })
})
