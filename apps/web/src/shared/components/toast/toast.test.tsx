import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ToastProvider, useToast } from "./toast"

afterEach(cleanup)

function Trigger({
  message,
  variant,
}: {
  message: string
  variant?: "success" | "error" | "info"
}) {
  const { show } = useToast()
  return (
    <button onClick={() => show(message, variant)}>
      show
    </button>
  )
}

function setup(message: string, variant?: "success" | "error" | "info") {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
  render(
    <ToastProvider>
      <Trigger message={message} variant={variant} />
    </ToastProvider>,
  )
  return user
}

describe("toast notification system", () => {
  it("shows a success toast with visible text", async () => {
    const user = setup("Payment confirmed", "success")
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getByText("Payment confirmed")).toBeInTheDocument()
  })

  it("shows an error toast with visible text", async () => {
    const user = setup("Transaction failed", "error")
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getByText("Transaction failed")).toBeInTheDocument()
  })

  it("shows an info toast with visible text", async () => {
    const user = setup("Loading wallet…", "info")
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getByText("Loading wallet…")).toBeInTheDocument()
  })

  it("toast has accessible role", async () => {
    const user = setup("Hello", "info")
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
  })

  it("dismisses toast manually via dismiss button", async () => {
    const user = setup("Click to dismiss", "info")
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getByText("Click to dismiss")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Click to dismiss")).not.toBeInTheDocument()
  })

  it("auto-dismisses after duration with fake timers", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(
      <ToastProvider>
        <Trigger message="auto gone" variant="info" />
      </ToastProvider>,
    )
    await user.click(screen.getByRole("button", { name: "show" }))
    expect(screen.getByText("auto gone")).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText("auto gone")).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it("queues multiple toasts", async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger message="first" variant="success" />
        <Trigger message="second" variant="error" />
      </ToastProvider>,
    )
    const [first, second] = screen.getAllByRole("button", { name: "show" })
    await user.click(first)
    await user.click(second)
    expect(screen.getByText("first")).toBeInTheDocument()
    expect(screen.getByText("second")).toBeInTheDocument()
  })

  it("defaults to info variant when no variant is supplied", async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger message="default variant" />
      </ToastProvider>,
    )
    await user.click(screen.getByRole("button", { name: "show" }))
    const toast = screen.getByLabelText(/Info: default variant/)
    expect(toast).toBeInTheDocument()
  })
})
