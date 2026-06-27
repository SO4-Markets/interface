import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { Modal } from "./Modal"

afterEach(cleanup)

function ModalHarness({
  label = "Test modal",
  initialOpen = false,
}: {
  label?: string
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open modal
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        aria-label={label}
      >
        <button onClick={() => setOpen(false)}>Close</button>
        <button>Another focusable</button>
      </Modal>
    </>
  )
}

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(<ModalHarness initialOpen={false} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders dialog when open", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole("button", { name: "Open modal" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("moves focus inside the modal on open", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole("button", { name: "Open modal" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it("fires onClose and focus returns to trigger on Escape", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    const trigger = screen.getByRole("button", { name: "Open modal" })
    await user.click(trigger)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it("fires onClose when close button inside modal is clicked", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole("button", { name: "Open modal" }))
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("traps tab focus within the modal", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole("button", { name: "Open modal" }))

    const [closeBtn, anotherBtn] = screen.getAllByRole("button", {
      name: /Close|Another focusable/,
    })
    closeBtn.focus()
    await user.tab()
    expect(document.activeElement).toBe(anotherBtn)
    await user.tab()
    expect(document.activeElement).toBe(closeBtn)
  })

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole("button", { name: "Open modal" }))
    const backdrop = screen.getByRole("presentation")
    await user.click(backdrop)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not call onClose when dialog content is clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open aria-label="test" onClose={onClose}>
        <button>inner button</button>
      </Modal>,
    )
    await user.click(screen.getByRole("button", { name: "inner button" }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
