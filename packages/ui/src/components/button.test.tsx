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
    const { rerender } = render(
      <Button onClick={handleClick}>Submit</Button>
    )
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
