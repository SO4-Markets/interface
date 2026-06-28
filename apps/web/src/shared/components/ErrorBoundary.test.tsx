import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ErrorBoundary } from "./ErrorBoundary"

afterEach(cleanup)

function Thrower({ message = "boom" }: { message?: string }) {
  throw new Error(message)
}

function Stable({ text }: { text: string }) {
  return <p>{text}</p>
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <Stable text="all good" />
      </ErrorBoundary>,
    )
    expect(screen.getByText("all good")).toBeInTheDocument()
  })

  it("renders fallback message when a child throws", () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("renders the error message in the fallback", () => {
    render(
      <ErrorBoundary>
        <Thrower message="network failure" />
      </ErrorBoundary>,
    )
    expect(screen.getByText("network failure")).toBeInTheDocument()
  })

  it("renders a retry button in the fallback", () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    )
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("re-renders children after clicking retry", async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    function MaybeThrow() {
      if (shouldThrow) throw new Error("oops")
      return <p>recovered</p>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    shouldThrow = false
    await user.click(screen.getByRole("button", { name: /try again/i }))
    expect(screen.getByText("recovered")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders a custom fallback prop when provided", () => {
    render(
      <ErrorBoundary fallback={<div>custom error UI</div>}>
        <Thrower />
      </ErrorBoundary>,
    )
    expect(screen.getByText("custom error UI")).toBeInTheDocument()
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument()
  })

  it("does not leak console.error noise across tests", () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    )
    expect(console.error).toHaveBeenCalled()
  })
})
