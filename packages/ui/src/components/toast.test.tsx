import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"

import {
  MAX_RETAINED_TOASTS,
  MAX_VISIBLE_TOASTS,
  TOAST_EXIT_MS,
  ToastProvider,
  getInFlightToasts,
  resetToastStore,
  toast,
  useToast,
} from "./toast"

function Probe() {
  const { toasts } = useToast()
  return <output data-testid="count">{toasts.length}</output>
}

function renderProvider() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  )
}

function statuses() {
  return screen.queryAllByRole("status").filter(el => el.getAttribute("aria-label"))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => resetToastStore())
  vi.useRealTimers()
})

describe("toast deduplication", () => {
  it("yields one terminal update for a burst of duplicate confirmations", () => {
    const listener = vi.fn()
    function Counter() {
      const { toasts } = useToast()
      listener(toasts)
      return null
    }
    render(<Counter />)
    listener.mockClear()

    act(() => {
      toast.loading("Submitting", { id: "tx:abc" })
    })
    listener.mockClear()

    // Separate act() calls so React cannot batch the duplicates away.
    for (let i = 0; i < 5; i++) {
      act(() => {
        toast.success("Confirmed", { id: "tx:abc" })
      })
    }

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "tx:abc", variant: "success", message: "Confirmed" }),
    ])
  })

  it("does not resurrect a settled outcome after it was dismissed", () => {
    renderProvider()
    act(() => {
      toast.loading("Submitting", { id: "tx:abc" })
      toast.success("Confirmed", { id: "tx:abc" })
    })
    act(() => toast.dismiss("tx:abc"))
    act(() => {
      toast.success("Confirmed", { id: "tx:abc" })
    })

    expect(screen.getByTestId("count")).toHaveTextContent("0")
  })

  it("lets a new progress stage re-open the lifecycle for the same id", () => {
    renderProvider()
    act(() => {
      toast.loading("Step 1", { id: "pool" })
      toast.success("Transaction confirmed", { id: "pool" })
      toast.loading("Step 2", { id: "pool" })
      toast.success("Transaction confirmed", { id: "pool" })
    })

    expect(statuses()).toHaveLength(1)
    expect(statuses()[0]).toHaveAttribute("aria-label", "Success: Transaction confirmed")
  })

  it("keeps distinct transactions independently inspectable", () => {
    renderProvider()
    act(() => {
      toast.loading("Opening long", { id: "tx:a" })
      toast.loading("Closing short", { id: "tx:b" })
      toast.success("Long opened", { id: "tx:a" })
      toast.error("Close failed", { id: "tx:b" })
    })

    expect(statuses().map(el => el.getAttribute("aria-label"))).toEqual([
      "Success: Long opened",
      "Error: Close failed",
    ])
  })

  it("collapses repeated anonymous toasts with the same content into one", () => {
    renderProvider()
    act(() => {
      for (let i = 0; i < 4; i++) toast.error("Price feed unavailable")
    })

    expect(statuses()).toHaveLength(1)
  })

  it("restarts the dismiss timer when a repeated toast is refreshed", () => {
    renderProvider()
    act(() => {
      toast.info("Address copied")
    })
    act(() => {
      vi.advanceTimersByTime(3000)
      toast.info("Address copied")
    })
    expect(statuses()).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(statuses()).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // The dismiss timer fired; the 150ms exit transition (OB-092) still has
    // to play before the row unmounts.
    expect(statuses()).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(statuses()).toHaveLength(0)
  })
})

describe("toast bounds", () => {
  it("renders at most the visible limit and exposes the rest behind an overflow control", () => {
    renderProvider()
    act(() => {
      for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i++) toast.info(`Notice ${i}`)
    })

    expect(statuses()).toHaveLength(MAX_VISIBLE_TOASTS)
    const overflow = screen.getByRole("button", { name: "Show 2 more" })
    expect(overflow).toHaveAttribute("aria-expanded", "false")

    act(() => overflow.click())
    expect(statuses()).toHaveLength(MAX_VISIBLE_TOASTS + 2)
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("flags hidden in-progress actions in the overflow control", () => {
    renderProvider()
    act(() => {
      toast.loading("Opening long", { id: "tx:a" })
      for (let i = 0; i < MAX_VISIBLE_TOASTS; i++) toast.info(`Notice ${i}`)
    })

    expect(screen.getByRole("button", { name: "Show 1 more (1 in progress)" })).toBeInTheDocument()
  })

  it("bounds retained toasts, evicting settled ones before unresolved progress", () => {
    renderProvider()
    act(() => {
      toast.loading("Opening long", { id: "tx:a" })
      for (let i = 0; i < MAX_RETAINED_TOASTS + 5; i++) {
        toast.show({ message: `Notice ${i}`, variant: "info", persistent: true })
      }
    })

    expect(screen.getByTestId("count")).toHaveTextContent(String(MAX_RETAINED_TOASTS))
    expect(getInFlightToasts().map(t => t.id)).toEqual(["tx:a"])
  })

  it("keeps evicted progress trackable when the whole stack is unresolved", () => {
    renderProvider()
    act(() => {
      for (let i = 0; i <= MAX_RETAINED_TOASTS; i++) toast.loading(`Tx ${i}`, { id: `tx:${i}` })
    })

    expect(screen.getByTestId("count")).toHaveTextContent(String(MAX_RETAINED_TOASTS))
    expect(getInFlightToasts()).toHaveLength(MAX_RETAINED_TOASTS + 1)

    act(() => {
      toast.success("Tx 0 confirmed", { id: "tx:0" })
    })
    expect(getInFlightToasts()).toHaveLength(MAX_RETAINED_TOASTS)
  })
})

describe("dismissed progress", () => {
  it("stays trackable, is not re-shown by later progress, and still gets one terminal update", () => {
    renderProvider()
    act(() => {
      toast.loading("Submitting", { id: "tx:a" })
    })
    act(() => toast.dismiss("tx:a"))

    expect(statuses()).toHaveLength(0)
    expect(getInFlightToasts().map(t => t.id)).toEqual(["tx:a"])
    expect(screen.getByRole("button", { name: "Show 1 more (1 in progress)" })).toBeInTheDocument()

    act(() => {
      toast.loading("Waiting for confirmation", { id: "tx:a" })
    })
    expect(statuses()).toHaveLength(0)
    expect(getInFlightToasts()[0]).toMatchObject({ message: "Waiting for confirmation" })

    act(() => {
      toast.success("Confirmed", { id: "tx:a" })
      toast.success("Confirmed", { id: "tx:a" })
    })
    expect(statuses()).toHaveLength(1)
    expect(getInFlightToasts()).toHaveLength(0)
  })

  it("can be restored from the overflow control", () => {
    renderProvider()
    act(() => {
      toast.loading("Submitting", { id: "tx:a" })
    })
    act(() => toast.dismiss("tx:a"))

    act(() => screen.getByRole("button", { name: /in progress/ }).click())

    expect(statuses()).toHaveLength(1)
    expect(statuses()[0]).toHaveAttribute("aria-label", "Transaction in progress: Submitting")
  })
})

/**
 * OB-091 (sole implementation) + OB-092 (motion) coverage for the merged
 * store. Upstream OB-098 owns queue bounds/dedup above; these suites own the
 * single-provider lifecycle and the presence-aware interruptible transitions.
 */

// jsdom lacks a stable requestAnimationFrame under fake timers; the toast
// entrance uses rAF, so provide a deterministic shim for these suites.
function stubRaf() {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
}

describe("sole notification implementation (OB-091)", () => {
  beforeEach(() => {
    stubRaf()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("delivers every supported call to the single mounted provider", () => {
    renderProvider()
    act(() => {
      toast.success("Saved")
      toast.error("Failed")
      toast.info("Note")
      toast.warning("Careful")
      toast.loading("Confirming…", { id: "confirm-1" })
    })
    // Five retained, three visible behind the overflow control (OB-098).
    // The in-progress toast is among the visible three, so no suffix.
    expect(screen.getByRole("button", { name: "Show 2 more" })).toBeInTheDocument()
    act(() => {
      screen.getByRole("button", { name: "Show 2 more" }).click()
    })
    expect(screen.getByText("Saved")).toBeInTheDocument()
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.getByText("Note")).toBeInTheDocument()
    expect(screen.getByText("Careful")).toBeInTheDocument()
    expect(screen.getByText("Confirming…")).toBeInTheDocument()
    // Exactly one stack container across routes (OB-091).
    expect(document.querySelectorAll("[aria-live='polite'][aria-atomic='false']")).toHaveLength(1)
  })

  it("upserts by id and dismisses by id (provider lifecycle)", () => {
    renderProvider()
    act(() => {
      toast.show({ id: "tx-1", message: "Submitting…", variant: "transaction-progress", duration: 0, persistent: true })
    })
    expect(screen.getByText("Submitting…")).toBeInTheDocument()
    act(() => {
      toast.show({ id: "tx-1", message: "Confirmed", variant: "success" })
    })
    expect(screen.queryByText("Submitting…")).toBeNull()
    expect(screen.getByText("Confirmed")).toBeInTheDocument()
    act(() => {
      toast.dismiss("tx-1")
    })
    expect(screen.queryByText("Confirmed")).toBeNull()
  })
})

describe("toast motion — entrance, updates, stacking, exit (OB-092)", () => {
  beforeEach(() => {
    stubRaf()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushEntrance() {
    act(() => {
      vi.advanceTimersByTime(0)
    })
  }

  it("updates content in place without replaying the entrance", () => {
    renderProvider()
    act(() => {
      toast.show({ id: "up-1", message: "Waiting…", variant: "transaction-progress", duration: 0, persistent: true })
    })
    flushEntrance()
    expect(screen.getByText("Waiting…").closest("[data-slot='toast']")).toHaveAttribute("data-state", "open")
    act(() => {
      toast.show({ id: "up-1", message: "Confirmed", variant: "success" })
    })
    const row = screen.getByText("Confirmed").closest("[data-slot='toast']")
    expect(row).not.toBeNull()
    expect(row?.getAttribute("data-variant")).toBe("success")
    // Same row identity: stable key, no remount, no duplicate.
    expect(document.querySelectorAll("[data-slot='toast']")).toHaveLength(1)
    act(() => {
      toast.dismiss("up-1")
    })
  })

  it("plays a symmetric exit on explicit dismiss with no interactive leftovers", () => {
    renderProvider()
    act(() => {
      toast.info("Goodbye", { duration: 0 })
    })
    flushEntrance()
    expect(screen.getByText("Goodbye").closest("[data-slot='toast']")).toHaveAttribute("data-state", "open")

    act(() => {
      screen.getByRole("button", { name: "Dismiss" }).click()
    })
    // Exit row stays mounted through the transition, inert and non-interactive.
    const exiting = screen.getByText("Goodbye").closest("[data-slot='toast']")
    expect(exiting).toHaveAttribute("data-state", "closed")
    expect(exiting).toHaveAttribute("aria-hidden", "true")
    expect(exiting).toHaveAttribute("inert")
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText("Goodbye")).toBeNull()
  })

  it("reverses an exit when the same toast updates mid-flight (rapid reversal)", () => {
    renderProvider()
    act(() => {
      toast.show({ id: "flip-1", message: "Working…", variant: "transaction-progress", duration: 0, persistent: true })
    })
    flushEntrance()
    act(() => {
      screen.getByRole("button", { name: "Dismiss" }).click()
    })
    expect(screen.getByText("Working…").closest("[data-slot='toast']")).toHaveAttribute("data-state", "closed")
    act(() => {
      toast.show({ id: "flip-1", message: "Working… done", variant: "transaction-progress", duration: 0, persistent: true })
    })
    flushEntrance()
    // Exactly one row, open again on the symmetric return path.
    expect(screen.getAllByText("Working… done")).toHaveLength(1)
    expect(screen.getByText("Working… done").closest("[data-slot='toast']")).toHaveAttribute("data-state", "open")
    act(() => {
      toast.dismiss("flip-1")
    })
  })

  it("uses semantic token surfaces and interruptible motion classes", () => {
    renderProvider()
    let id = ""
    act(() => {
      id = toast.error("Boom", { duration: 0 })
    })
    const node = screen.getByText("Boom").closest("[data-slot='toast']")
    expect(node?.className).toMatch("bg-danger-subtle")
    expect(node?.className).toMatch("transition-\\[opacity,transform\\]")
    expect(node?.className).toMatch("motion-reduce:transition-none")
    act(() => {
      toast.dismiss(id)
    })
    expect(screen.queryByText("Boom")).toBeNull()
  })
})
