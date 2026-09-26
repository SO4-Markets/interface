import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Toc } from "./Toc"

describe("DX-032: Toc component", () => {
  let mockObserve: ReturnType<typeof vi.fn>
  let mockDisconnect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockObserve = vi.fn()
    mockDisconnect = vi.fn()

    class MockIntersectionObserver {
      observe = mockObserve
      disconnect = mockDisconnect
      unobserve = vi.fn()
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders nothing when there are fewer than 2 headings", () => {
    const { container } = render(
      <Toc
        entries={[{ title: "Single Heading", id: "single-heading", level: 2 }]}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders table of contents when there are 2 or more headings", () => {
    render(
      <Toc
        entries={[
          { title: "First Section", id: "first-section", level: 2 },
          { title: "Second Section", id: "second-section", level: 2 },
        ]}
      />
    )

    expect(
      screen.getByRole("navigation", { name: "Table of contents" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "First Section" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Second Section" })
    ).toBeInTheDocument()
  })

  it("nests h3 headings under h2 headings", () => {
    const { container } = render(
      <Toc
        entries={[
          { title: "Main Topic", id: "main-topic", level: 2 },
          { title: "Subtopic Detail", id: "subtopic-detail", level: 3 },
        ]}
      />
    )

    const subtopicItem = container.querySelector("li.ps-3")
    expect(subtopicItem).not.toBeNull()
    expect(subtopicItem?.textContent).toContain("Subtopic Detail")
  })

  it("sets active state on click and invokes onSelect callback", () => {
    const onSelect = vi.fn()
    render(
      <Toc
        entries={[
          { title: "Overview", id: "overview", level: 2 },
          { title: "Details", id: "details", level: 2 },
        ]}
        onSelect={onSelect}
      />
    )

    const detailsLink = screen.getByRole("link", { name: "Details" })
    fireEvent.click(detailsLink)

    expect(onSelect).toHaveBeenCalledWith("details")
    expect(detailsLink).toHaveAttribute("aria-current", "location")
  })
})
