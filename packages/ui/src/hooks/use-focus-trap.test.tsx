import { useRef, useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useFocusTrap } from "./use-focus-trap"

type HarnessProps = {
  initialFocus?: boolean
  returnToOther?: boolean
  includeToggle?: boolean
  empty?: boolean
  onEscape?: () => void
}

function Harness({
  initialFocus = false,
  returnToOther = false,
  includeToggle = false,
  empty = false,
  onEscape,
}: HarnessProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const secondRef = useRef<HTMLButtonElement>(null)
  const otherRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    initialFocus: initialFocus ? () => secondRef.current : undefined,
    returnFocus: returnToOther ? () => otherRef.current : undefined,
    include: includeToggle ? () => [toggleRef.current] : undefined,
    onEscape: onEscape
      ? () => {
          onEscape()
          setOpen(false)
        }
      : undefined,
  })

  return (
    <>
      <button ref={otherRef}>Other</button>
      <button ref={toggleRef} onClick={() => setOpen((value) => !value)}>
        Toggle
      </button>
      {open && (
        <div ref={panelRef} role="dialog" aria-label="Panel" tabIndex={-1}>
          {!empty && (
            <>
              <button>First</button>
              <button ref={secondRef}>Second</button>
              <button onClick={() => setOpen(false)}>Last</button>
              <button disabled>Disabled</button>
              <div inert>
                <button>Inert</button>
              </div>
            </>
          )}
        </div>
      )}
      <button>After</button>
    </>
  )
}

function button(name: string) {
  return screen.getByRole("button", { name, hidden: true })
}

describe("useFocusTrap", () => {
  it("moves focus to the first tabbable element when it activates", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(button("Toggle"))

    expect(button("First")).toHaveFocus()
  })

  it("moves focus to the requested initial element", async () => {
    const user = userEvent.setup()
    render(<Harness initialFocus />)

    await user.click(button("Toggle"))

    expect(button("Second")).toHaveFocus()
  })

  it("wraps Tab and Shift+Tab inside the container, skipping disabled and inert controls", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(button("Toggle"))

    await user.tab()
    expect(button("Second")).toHaveFocus()
    await user.tab()
    expect(button("Last")).toHaveFocus()
    await user.tab()
    expect(button("First")).toHaveFocus()
    await user.tab({ shift: true })
    expect(button("Last")).toHaveFocus()
  })

  it("includes controls outside the container in document order", async () => {
    const user = userEvent.setup()
    render(<Harness includeToggle />)
    await user.click(button("Toggle"))

    button("Last").focus()
    await user.tab()
    expect(button("Toggle")).toHaveFocus()
    await user.tab()
    expect(button("First")).toHaveFocus()
    await user.tab({ shift: true })
    expect(button("Toggle")).toHaveFocus()
  })

  it("pulls focus back in when Tab is pressed from outside the trap", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(button("Toggle"))

    button("After").focus()
    await user.tab()

    expect(button("First")).toHaveFocus()
  })

  it("keeps focus on the container when it has no tabbable content", async () => {
    const user = userEvent.setup()
    render(<Harness empty />)
    await user.click(button("Toggle"))
    const panel = screen.getByRole("dialog", { name: "Panel" })

    expect(panel).toHaveFocus()
    await user.tab()
    expect(panel).toHaveFocus()
  })

  it("calls onEscape and restores focus to the element focused before opening", async () => {
    const onEscape = vi.fn()
    const user = userEvent.setup()
    render(<Harness onEscape={onEscape} />)
    await user.click(button("Toggle"))

    await user.keyboard("{Escape}")

    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(button("Toggle")).toHaveFocus()
  })

  it("restores focus to the requested return element", async () => {
    const user = userEvent.setup()
    render(<Harness returnToOther />)
    await user.click(button("Toggle"))

    await user.click(button("Last"))

    expect(button("Other")).toHaveFocus()
  })

  it("does not steal focus that already moved outside the trap", async () => {
    const user = userEvent.setup()
    render(<Harness onEscape={() => undefined} />)
    await user.click(button("Toggle"))
    button("After").focus()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(button("After")).toHaveFocus()
  })

  it("leaves Escape to the browser when no handler is given", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.defaultPrevented)
    document.addEventListener("keydown", onKeyDown)
    render(<Harness />)
    await user.click(button("Toggle"))

    await user.keyboard("{Escape}")

    expect(onKeyDown).toHaveLastReturnedWith(false)
    expect(screen.getByRole("dialog", { name: "Panel" })).toBeInTheDocument()
    document.removeEventListener("keydown", onKeyDown)
  })
})
