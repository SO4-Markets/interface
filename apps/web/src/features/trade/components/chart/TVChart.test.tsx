import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useChartPreferencesStore } from "../../store/chart-preferences-store"
import { TVChart } from "./TVChart"

vi.mock("./ChartHeader", () => ({ ChartHeader: () => null }))
vi.mock("./TVChartContainer", () => ({ TVChartContainer: () => null }))
vi.mock("../../hooks/useMarkets", () => ({ useMarkets: () => ({ markets: [] }) }))

/** Captures the toolbar's observer so a test can fire a layout change. */
class ResizeObserverMock {
  static instances: Array<ResizeObserverMock> = []
  observed: Array<Element> = []
  constructor(public callback: () => void) {
    ResizeObserverMock.instances.push(this)
  }
  observe(element: Element) {
    this.observed.push(element)
  }
  unobserve() {}
  disconnect() {
    this.observed = []
  }
}

/** Gives each timeframe button a horizontal slot so offsets are measurable. */
function layoutButtons(toolbar: HTMLElement, buttonWidth: number) {
  toolbar.getBoundingClientRect = () => ({ left: 0, width: 400 }) as DOMRect
  within(toolbar)
    .getAllByRole("button")
    .forEach((button, index) => {
      button.getBoundingClientRect = () =>
        ({ left: 12 + index * (buttonWidth + 4), width: buttonWidth }) as DOMRect
    })
}

function indicatorOf(toolbar: HTMLElement) {
  const indicator = toolbar.querySelector<HTMLElement>("[role='presentation']")
  if (!indicator) throw new Error("timeframe indicator not rendered")
  return indicator
}

describe("TVChart timeframe toolbar (#1056)", () => {
  const originalResizeObserver = globalThis.ResizeObserver

  beforeEach(() => {
    ResizeObserverMock.instances = []
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
    useChartPreferencesStore.setState({ period: "5m" })
  })

  afterEach(() => {
    cleanup()
    globalThis.ResizeObserver = originalResizeObserver
  })

  it("sizes every timeframe for touch and names the current one plainly", () => {
    render(<TVChart symbol="BTC" onSelectToken={() => {}} />)
    const toolbar = screen.getByRole("group", { name: "Chart timeframe selection" })

    for (const button of within(toolbar).getAllByRole("button")) {
      expect(button).toHaveClass("touch-target", "shrink-0")
    }
    expect(screen.getByRole("button", { name: "5m timeframe" })).toHaveAttribute("title", "5m chart (current)")
    expect(screen.getByRole("button", { name: "1h timeframe" })).toHaveAttribute("title", "Switch to 1h chart")
  })

  it("keeps the selection highlight on the active timeframe when the toolbar resizes", () => {
    render(<TVChart symbol="BTC" onSelectToken={() => {}} />)
    const toolbar = screen.getByRole("group", { name: "Chart timeframe selection" })
    const observer = ResizeObserverMock.instances.find((instance) => instance.observed.includes(toolbar))
    expect(observer).toBeDefined()

    // Desktop-sized buttons…
    layoutButtons(toolbar, 30)
    act(() => observer!.callback())
    expect(indicatorOf(toolbar).style.transform).toBe("translateX(46px)")
    expect(indicatorOf(toolbar).style.width).toBe("30px")

    // …then the buttons grow to touch size (coarse pointer, rotation).
    layoutButtons(toolbar, 44)
    act(() => observer!.callback())
    expect(indicatorOf(toolbar).style.transform).toBe("translateX(60px)")
    expect(indicatorOf(toolbar).style.width).toBe("44px")
  })

  it("measures the highlight in scrolled content space", () => {
    render(<TVChart symbol="BTC" onSelectToken={() => {}} />)
    const toolbar = screen.getByRole("group", { name: "Chart timeframe selection" })
    const observer = ResizeObserverMock.instances.find((instance) => instance.observed.includes(toolbar))

    layoutButtons(toolbar, 44)
    toolbar.scrollLeft = 20
    act(() => observer!.callback())
    expect(indicatorOf(toolbar).style.transform).toBe("translateX(80px)")
  })

  it("still moves between timeframes with the arrow keys", () => {
    render(<TVChart symbol="BTC" onSelectToken={() => {}} />)
    const toolbar = screen.getByRole("group", { name: "Chart timeframe selection" })

    fireEvent.keyDown(toolbar, { key: "ArrowRight" })
    expect(useChartPreferencesStore.getState().period).toBe("15m")
    fireEvent.keyDown(toolbar, { key: "ArrowLeft" })
    expect(useChartPreferencesStore.getState().period).toBe("5m")
  })

  it("stops observing when unmounted", () => {
    const { unmount } = render(<TVChart symbol="BTC" onSelectToken={() => {}} />)
    const toolbar = screen.getByRole("group", { name: "Chart timeframe selection" })
    const observer = ResizeObserverMock.instances.find((instance) => instance.observed.includes(toolbar))
    unmount()
    expect(observer!.observed).toEqual([])
  })
})
