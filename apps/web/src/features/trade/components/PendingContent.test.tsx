import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PendingContent } from "./PendingContent"

describe("PendingContent", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("shows pending component on initial load", () => {
    vi.advanceTimersByTime(300)

    render(
      <PendingContent
        isLoading={true}
        data={null}
        pendingComponent={<div>Loading...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.queryByText("Content")).not.toBeInTheDocument()
  })

  it("shows content when data arrives", () => {
    const { rerender } = render(
      <PendingContent
        isLoading={true}
        data={null}
        pendingComponent={<div>Loading...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    vi.advanceTimersByTime(300)

    rerender(
      <PendingContent
        isLoading={false}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
  })

  it("keeps content visible on background refetch", () => {
    const { rerender } = render(
      <PendingContent
        isLoading={false}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.getByText("Content")).toBeInTheDocument()

    // Background refetch
    rerender(
      <PendingContent
        isLoading={true}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    vi.advanceTimersByTime(300)

    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
  })

  it("shows overlay during background refetch", () => {
    const { rerender } = render(
      <PendingContent
        isLoading={false}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
        overlay={<div>Updating...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.queryByText("Updating...")).not.toBeInTheDocument()

    // Background refetch
    rerender(
      <PendingContent
        isLoading={true}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
        overlay={<div>Updating...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.getByText("Updating...")).toBeInTheDocument()
  })

  it("respects custom loading delay", () => {
    render(
      <PendingContent
        isLoading={true}
        data={null}
        pendingComponent={<div>Loading...</div>}
        loadingDelay={500}
      >
        <div>Content</div>
      </PendingContent>
    )

    vi.advanceTimersByTime(300)
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()

    vi.advanceTimersByTime(200)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("applies custom className to container", () => {
    const { container } = render(
      <PendingContent
        isLoading={true}
        data={null}
        pendingComponent={<div>Loading...</div>}
        className="custom-class"
      >
        <div>Content</div>
      </PendingContent>
    )

    vi.advanceTimersByTime(300)

    const contentDiv = container.querySelector(".custom-class")
    expect(contentDiv).toBeInTheDocument()
  })

  it("hides overlay when loading completes", () => {
    const { rerender } = render(
      <PendingContent
        isLoading={true}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
        overlay={<div>Updating...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    vi.advanceTimersByTime(300)
    expect(screen.getByText("Updating...")).toBeInTheDocument()

    rerender(
      <PendingContent
        isLoading={false}
        data={{ id: "1" }}
        pendingComponent={<div>Loading...</div>}
        overlay={<div>Updating...</div>}
      >
        <div>Content</div>
      </PendingContent>
    )

    expect(screen.queryByText("Updating...")).not.toBeInTheDocument()
  })
})
