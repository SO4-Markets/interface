import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HeaderMenu } from "./header-menu"
import type { ComponentProps } from "react"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props} />
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.style.overflow = ""
})

describe("HeaderMenu", () => {
  it("restores focus on Escape and keeps closed menu links inert", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const user = userEvent.setup()
    render(<HeaderMenu />)
    const trigger = screen.getByRole("button", { name: "Open menu" })

    await user.click(trigger)
    const panel = screen.getByRole("dialog", { name: "Site menu" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-controls", panel.id)
    expect(panel).not.toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("hidden")

    await user.keyboard("{Escape}")
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(panel).toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("")
  })
})
