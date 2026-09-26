import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import { axe } from "vitest-axe"
import { describe, expect, it } from "vitest"
import { KeyboardShortcut } from "@workspace/ui/components/keyboard-shortcut"
import { DocsHome } from "./DocsHome"

describe("DocsHome", () => {
  it("renders the placeholder route", () => {
    render(<DocsHome />)
    expect(
      screen.getByRole("heading", { level: 1, name: "SO4 Docs" })
    ).toBeInTheDocument()
  })

  it("opens search and shortcut list from keyboard shortcuts", async () => {
    const user = userEvent.setup()
    render(<DocsHome />)

    await user.keyboard("{Control>}k{/Control}")
    expect(
      screen.getByRole("dialog", { name: "Search docs" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.keyboard("?")
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument()
  })

  it("never fires shortcuts while typing in editable regions", async () => {
    const user = userEvent.setup()
    render(
      <>
        <DocsHome />
        <input aria-label="External input" />
        <textarea aria-label="External textarea" />
        <div contentEditable aria-label="Editable region" role="textbox" />
      </>
    )

    await user.click(screen.getByLabelText("External input"))
    await user.keyboard("{Control>}k{/Control}")
    expect(
      screen.queryByRole("dialog", { name: "Search docs" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("External textarea"))
    await user.keyboard("?")
    expect(
      screen.queryByRole("dialog", { name: "Keyboard shortcuts" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Editable region"))
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}")
    expect(
      screen.getByRole("heading", { level: 1, name: "SO4 Docs" })
    ).toBeInTheDocument()
  })

  it("moves through pages with previous and next shortcuts", async () => {
    const user = userEvent.setup()
    render(<DocsHome />)

    // The next page after the docs home is the committed MDX fixture — see
    // `docsPages` in ../lib/docs-pages.
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}")
    expect(
      screen.getByRole("heading", { level: 1, name: "MDX Kitchen Sink" })
    ).toBeInTheDocument()

    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}")
    expect(
      screen.getByRole("heading", { level: 1, name: "SO4 Docs" })
    ).toBeInTheDocument()
  })

  it("renders platform-specific key labels through KeyboardShortcut", () => {
    render(<KeyboardShortcut keys={["Mod", "K"]} platform="mac" />)
    expect(screen.getByLabelText("⌘ + K")).toBeInTheDocument()
  })

  it("has no axe violations in representative states across themes", async () => {
    for (const theme of ["light", "dark"]) {
      document.documentElement.className = theme
      const { container, unmount } = render(
        <DocsHome initialSlug="/developers/architecture" />
      )
      expect(await axe(container)).toHaveNoViolations()
      unmount()
    }
  })

  it("has no axe violations with mobile sidebar, search results, and switched tabs open", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <DocsHome initialSlug="/reference/code-groups" />
    )

    await user.keyboard("{Control>}{Shift>}s{/Shift}{/Control}")
    await user.keyboard("{Control>}k{/Control}")
    await user.click(screen.getByRole("tab", { name: /bash/i }))

    expect(await axe(container)).toHaveNoViolations()
  })

  it("keeps one h1, ordered headings, and landmarks on representative pages", () => {
    for (const slug of [
      "/",
      "/concepts/risk",
      "/developers/architecture",
      "/reference/code-groups",
      "/search",
    ]) {
      const { container, unmount } = render(<DocsHome initialSlug={slug} />)
      expect(container.querySelectorAll("h1")).toHaveLength(1)
      expect(hasSkippedHeadingLevel(container)).toBe(false)
      expect(screen.getByRole("banner")).toBeInTheDocument()
      expect(screen.getByRole("main")).toBeInTheDocument()
      expect(
        screen.getByRole("navigation", { name: "Docs navigation" })
      ).toBeInTheDocument()
      unmount()
    }
  })

  it("heading-order assertion fails on a broken fixture", () => {
    const { container } = render(
      <main>
        <h1>Broken</h1>
        <h3>Skipped</h3>
      </main>
    )

    expect(hasSkippedHeadingLevel(container)).toBe(true)
  })
})

function hasSkippedHeadingLevel(container: HTMLElement): boolean {
  let previous = 0
  for (const heading of Array.from(
    container.querySelectorAll("h1,h2,h3,h4,h5,h6")
  )) {
    const current = Number(heading.tagName.slice(1))
    if (previous && current > previous + 1) return true
    previous = current
  }
  return false
}
