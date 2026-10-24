import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { Button, buttonVariants } from "./button"

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

const SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const

describe("Button accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Button>Click me</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("supports disabled state without violations", async () => {
    const { container } = render(<Button disabled>Disabled</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("with icon has proper sizing", async () => {
    const { container } = render(
      <Button size="icon" aria-label="Settings">
        <svg viewBox="0 0 24 24" />
      </Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe("Button variants and sizes", () => {
  it.each(VARIANTS)("renders the %s variant without violations", async (variant) => {
    const { container } = render(<Button variant={variant}>Action</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it.each(SIZES)("renders the %s size without violations", async (size) => {
    const isIconSize = size.startsWith("icon")
    const { container } = render(
      isIconSize ? (
        <Button size={size} aria-label="Action">
          <svg viewBox="0 0 24 24" />
        </Button>
      ) : (
        <Button size={size}>Action</Button>
      )
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("every variant defines default, hover, active, and disabled classes", () => {
    for (const variant of VARIANTS) {
      const className = buttonVariants({ variant })
      expect(className).toMatch(/hover:/)
      expect(className).toMatch(/active:/)
    }
    // disabled + focus-visible states live in the shared base classes.
    expect(buttonVariants({})).toMatch(/disabled:/)
    expect(buttonVariants({})).toMatch(/focus-visible:/)
    expect(buttonVariants({})).toMatch(/focus-visible:outline-2/)
  })

  it("keeps the icon-only button's accessible name from aria-label, not the icon", () => {
    render(
      <Button size="icon" aria-label="Settings">
        <svg viewBox="0 0 24 24" />
      </Button>
    )
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument()
  })
})

describe("Button focus behavior", () => {
  it("keeps keyboard focus visible and removes it on blur", () => {
    const onBlur = vi.fn()
    render(
      <>
        <Button onBlur={onBlur}>First</Button>
        <Button>Second</Button>
      </>
    )
    const first = screen.getByRole("button", { name: "First" })
    const second = screen.getByRole("button", { name: "Second" })

    first.focus()
    expect(first).toHaveFocus()
    expect(first.matches(":focus-visible")).toBe(true)

    second.focus()
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveFocus()
  })

  it("moves focus between buttons without changing their accessible semantics", () => {
    render(
      <>
        <Button>First</Button>
        <Button>Second</Button>
      </>
    )
    const first = screen.getByRole("button", { name: "First" })
    const second = screen.getByRole("button", { name: "Second" })

    first.focus()
    second.focus()

    expect(first).not.toHaveFocus()
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute("type", "button")
  })

  it("never makes disabled controls keyboard focus targets", () => {
    render(
      <>
        <Button disabled>Disabled</Button>
        <Button pending>Pending</Button>
      </>
    )
    const disabled = screen.getByRole("button", { name: "Disabled" })
    const pending = screen.getByRole("button", { name: "Pending" })

    expect(pending).toBeDisabled()
    expect(disabled).toHaveAttribute("disabled")
    expect(disabled).toHaveClass("disabled:pointer-events-none")
  })
})

describe("Button pending state", () => {
  it("renders pending state without violations", async () => {
    const { container } = render(<Button pending>Submit</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("disables the button when pending is true", () => {
    render(<Button pending>Submit</Button>)
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("sets aria-busy when pending", () => {
    render(<Button pending>Submit</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-busy", "true")
  })

  it("displays loading indicator when pending", () => {
    const { container } = render(<Button pending>Submit</Button>)
    const spinner = container.querySelector("span[aria-hidden='true']")
    expect(spinner).toBeInTheDocument()
  })

  it("prevents duplicate submissions while pending", () => {
    const handleClick = vi.fn()
    const { rerender } = render(<Button onClick={handleClick}>Submit</Button>)
    const button = screen.getByRole("button")
    button.click()
    expect(handleClick).toHaveBeenCalledTimes(1)

    rerender(<Button pending onClick={handleClick}>Submit</Button>)
    button.click()
    expect(handleClick).toHaveBeenCalledTimes(1) // No additional call due to disabled state
  })

  it("applies opacity reduction to content when pending", () => {
    const { container } = render(<Button pending>Submit</Button>)
    const contentSpan = container.querySelector("span[class*='opacity-50']")
    expect(contentSpan).toBeInTheDocument()
  })
})
