import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { ScrollArea } from "./scroll-area"

/**
 * jsdom has no layout engine, so scroll metrics have to be supplied. These
 * helpers stand in for "content taller/wider than the viewport".
 */
function setMetrics(
  element: HTMLElement,
  metrics: Partial<
    Record<
      | "scrollTop"
      | "scrollLeft"
      | "scrollHeight"
      | "clientHeight"
      | "scrollWidth"
      | "clientWidth",
      number
    >
  >
) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
}

function getRoot() {
  const root = document.querySelector<HTMLElement>("[data-slot='scroll-area']")
  if (!root) throw new Error("scroll area not rendered")
  return root
}

function getViewport() {
  const viewport = document.querySelector<HTMLElement>(
    "[data-slot='scroll-area-viewport']"
  )
  if (!viewport) throw new Error("scroll area viewport not rendered")
  return viewport
}

async function scrollTo(viewport: HTMLElement, metrics: Parameters<typeof setMetrics>[1]) {
  setMetrics(viewport, metrics)
  await act(async () => {
    viewport.dispatchEvent(new Event("scroll"))
  })
}

/** Records observers so tests can fire them the way a real resize would. */
class ResizeObserverMock {
  static instances: Array<ResizeObserverMock> = []
  constructor(private callback: () => void) {
    ResizeObserverMock.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  static triggerAll() {
    for (const instance of ResizeObserverMock.instances) instance.callback()
  }
}

beforeEach(() => {
  ResizeObserverMock.instances = []
  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ScrollArea", () => {
  it("renders content in a native scroll container", () => {
    render(
      <ScrollArea>
        <p>Row</p>
      </ScrollArea>
    )
    expect(screen.getByText("Row")).toBeInTheDocument()
    expect(getViewport()).toHaveClass("overflow-y-auto")
  })

  it("defaults to the vertical axis and clips the cross axis", () => {
    render(<ScrollArea>Content</ScrollArea>)
    expect(getRoot()).toHaveAttribute("data-orientation", "vertical")
    expect(getViewport()).toHaveClass("overflow-x-hidden")
  })

  it("supports the horizontal axis", () => {
    render(<ScrollArea orientation="horizontal">Content</ScrollArea>)
    expect(getRoot()).toHaveAttribute("data-orientation", "horizontal")
    expect(getViewport()).toHaveClass("overflow-x-auto")
    expect(getViewport()).toHaveClass("overflow-y-hidden")
  })

  it("supports both axes", () => {
    render(<ScrollArea orientation="both">Content</ScrollArea>)
    expect(getViewport()).toHaveClass("overflow-auto")
  })

  it("renders edge affordances per axis and hides them from assistive tech", () => {
    const { rerender } = render(<ScrollArea>Content</ScrollArea>)
    const edges = () =>
      Array.from(
        document.querySelectorAll("[data-slot='scroll-area-edge']")
      ).map((edge) => edge.getAttribute("data-edge"))

    expect(edges()).toEqual(["top", "bottom"])
    expect(
      document.querySelector("[data-slot='scroll-area-edge']")
    ).toHaveAttribute("aria-hidden", "true")

    rerender(<ScrollArea orientation="horizontal">Content</ScrollArea>)
    expect(edges()).toEqual(["left", "right"])

    rerender(<ScrollArea orientation="both">Content</ScrollArea>)
    expect(edges()).toEqual(["top", "bottom", "left", "right"])

    rerender(<ScrollArea edgeShadows={false}>Content</ScrollArea>)
    expect(edges()).toEqual([])
  })

  it("detects overflow below the fold on mount", async () => {
    render(<ScrollArea>Content</ScrollArea>)
    const viewport = getViewport()
    setMetrics(viewport, {
      scrollTop: 0,
      scrollHeight: 500,
      clientHeight: 100,
    })
    ResizeObserverMock.triggerAll()

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-bottom", "true")
    })
    // Nothing above the top edge yet.
    expect(getRoot()).toHaveAttribute("data-overflow-top", "false")
  })

  it("flips the edge states as the viewport scrolls", async () => {
    render(<ScrollArea>Content</ScrollArea>)
    const viewport = getViewport()

    await scrollTo(viewport, {
      scrollTop: 200,
      scrollHeight: 500,
      clientHeight: 100,
    })
    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-top", "true")
    })
    expect(getRoot()).toHaveAttribute("data-overflow-bottom", "true")

    // Scrolled to the very bottom — only the start edge has content behind it.
    await scrollTo(viewport, { scrollTop: 400 })
    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-bottom", "false")
    })
    expect(getRoot()).toHaveAttribute("data-overflow-top", "true")
  })

  it("reports horizontal edges only on a horizontal axis", async () => {
    render(<ScrollArea orientation="horizontal">Content</ScrollArea>)
    const viewport = getViewport()

    await scrollTo(viewport, {
      scrollLeft: 40,
      scrollWidth: 800,
      clientWidth: 200,
      scrollTop: 100,
      scrollHeight: 500,
      clientHeight: 100,
    })

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-right", "true")
    })
    expect(getRoot()).toHaveAttribute("data-overflow-left", "true")
    // Vertical metrics are ignored on this axis.
    expect(getRoot()).toHaveAttribute("data-overflow-top", "false")
    expect(getRoot()).toHaveAttribute("data-overflow-bottom", "false")
  })

  it("re-measures when the container or its content resizes", async () => {
    render(<ScrollArea>Content</ScrollArea>)
    const viewport = getViewport()
    setMetrics(viewport, { scrollTop: 0, scrollHeight: 100, clientHeight: 100 })
    ResizeObserverMock.triggerAll()
    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-bottom", "false")
    })

    // Content grew — rows arrived — without any scrolling happening.
    setMetrics(viewport, { scrollHeight: 900 })
    await act(async () => {
      ResizeObserverMock.triggerAll()
    })
    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-bottom", "true")
    })
  })

  it("re-measures on window resize", async () => {
    render(<ScrollArea>Content</ScrollArea>)
    setMetrics(getViewport(), {
      scrollTop: 0,
      scrollHeight: 400,
      clientHeight: 100,
    })

    await act(async () => {
      window.dispatchEvent(new Event("resize"))
    })

    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-bottom", "true")
    })
  })

  it("keeps scroll updates out of React renders", async () => {
    const renders = vi.fn()
    function Counted() {
      renders()
      return <ScrollArea>Content</ScrollArea>
    }
    render(<Counted />)
    const before = renders.mock.calls.length
    const viewport = getViewport()

    for (const scrollTop of [10, 20, 30, 40, 50]) {
      await scrollTo(viewport, { scrollTop, scrollHeight: 500, clientHeight: 100 })
    }
    await waitFor(() => {
      expect(getRoot()).toHaveAttribute("data-overflow-top", "true")
    })

    // Edge state lives in DOM attributes, so scrolling renders nothing.
    expect(renders.mock.calls.length).toBe(before)
  })

  it("notifies opt-in subscribers of edge changes", async () => {
    const onEdgesChange = vi.fn()
    render(<ScrollArea onEdgesChange={onEdgesChange}>Content</ScrollArea>)

    await scrollTo(getViewport(), {
      scrollTop: 50,
      scrollHeight: 500,
      clientHeight: 100,
    })

    await waitFor(() => {
      expect(onEdgesChange).toHaveBeenCalledWith(
        expect.objectContaining({ top: true, bottom: true })
      )
    })
  })

  it("is not a tab stop unless asked to be", () => {
    render(<ScrollArea>Content</ScrollArea>)
    expect(getViewport()).not.toHaveAttribute("tabindex")
    expect(getViewport()).not.toHaveAttribute("role")
  })

  it("becomes a named, keyboard-scrollable region when focusable", async () => {
    const user = userEvent.setup()
    render(
      <ScrollArea focusable aria-label="Order log">
        Content
      </ScrollArea>
    )
    const viewport = getViewport()
    expect(viewport).toHaveAttribute("tabindex", "0")
    expect(viewport).toHaveAttribute("role", "region")

    await user.tab()
    expect(viewport).toHaveFocus()
  })

  it("keeps focusable content reachable by keyboard", async () => {
    const user = userEvent.setup()
    render(
      <ScrollArea>
        <button type="button">First</button>
        <button type="button">Second</button>
      </ScrollArea>
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus()
  })

  it("merges caller classes on the wrapper and the viewport", () => {
    render(
      <ScrollArea className="max-h-80" viewportClassName="p-2">
        Content
      </ScrollArea>
    )
    expect(getRoot()).toHaveClass("max-h-80")
    expect(getViewport()).toHaveClass("p-2")
  })

  // Regression: scrollbar-thumb sizing (`data-vertical:w-2.5`, `touch-none`)
  // once leaked onto the wrapper. `data-orientation` matches those variants,
  // so every vertical area collapsed to a 10px column (the trade shortcuts
  // dialog rendered blank) and touch scrolling and text selection were off.
  it.each(["vertical", "horizontal", "both"] as const)(
    "keeps the %s wrapper full-size, touch-scrollable, and selectable",
    (orientation) => {
      render(<ScrollArea orientation={orientation}>Content</ScrollArea>)
      const classes = getRoot().className.split(/\s+/)
      for (const forbidden of ["touch-none", "select-none", "p-px"]) {
        expect(classes).not.toContain(forbidden)
      }
      expect(classes.some((c) => /^data-(vertical|horizontal):/.test(c))).toBe(
        false
      )
    }
  )

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ScrollArea focusable aria-label="Positions">
        <p>Row</p>
      </ScrollArea>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
