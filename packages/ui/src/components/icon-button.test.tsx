import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { IconButton } from "./icon-button"

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

describe("IconButton accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<IconButton icon={<PlusIcon />} label="Add item" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("uses the label as the accessible name", () => {
    render(<IconButton icon={<PlusIcon />} label="Add item" />)
    const btn = screen.getByRole("button", { name: "Add item" })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveClass("touch-target")
  })

  it("supports disabled state without violations", async () => {
    const { container } = render(
      <IconButton icon={<PlusIcon />} label="Add item" disabled />
    )
    expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled()

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<IconButton icon={<PlusIcon />} label="Add item" disabled onClick={onClick} />)

    await user.click(screen.getByRole("button", { name: "Add item" }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe("IconButton tooltip", () => {
  it("shows the label as tooltip content for keyboard users on focus", async () => {
    render(<IconButton icon={<PlusIcon />} label="Add item" />)
    const button = screen.getByRole("button", { name: "Add item" })

    fireEvent.focus(button)

    expect(await screen.findByText("Add item", { selector: '[data-slot="tooltip-content"]' })).toBeInTheDocument()
  })

  it("shows the label as tooltip content for mouse users on hover", async () => {
    const user = userEvent.setup()
    render(<IconButton icon={<PlusIcon />} label="Add item" />)
    const button = screen.getByRole("button", { name: "Add item" })

    await user.hover(button)

    expect(
      await screen.findByText(
        "Add item",
        { selector: '[data-slot="tooltip-content"]' },
        { timeout: 2000 }
      )
    ).toBeInTheDocument()
  })

  it("supports a distinct tooltip string separate from the accessible label", async () => {
    render(
      <IconButton icon={<PlusIcon />} label="Add item" tooltip="Add a new item to the list" />
    )
    const button = screen.getByRole("button", { name: "Add item" })

    fireEvent.focus(button)

    expect(
      await screen.findByText("Add a new item to the list", {
        selector: '[data-slot="tooltip-content"]',
      })
    ).toBeInTheDocument()
  })
})
