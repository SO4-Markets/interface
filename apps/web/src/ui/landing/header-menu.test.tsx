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
    expect(trigger).toHaveClass("min-h-11", "min-w-11")

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

  it("keeps Tab focus inside the open menu and its toggle", async () => {
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
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    expect(focusables[0]).toHaveFocus()

    focusables[focusables.length - 1].focus()
    await user.tab()
    expect(trigger).toHaveFocus()
    await user.tab()
    expect(focusables[0]).toHaveFocus()
    await user.tab({ shift: true })
    expect(trigger).toHaveFocus()
  })

  it("renders the mobile menu outside the scrolled header", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    render(<HeaderMenu />)

    const header = document.querySelector("header.so4-scroll-header")
    const panel = document.getElementById("landing-mobile-menu")

    expect(header).not.toBeNull()
    expect(panel).not.toBeNull()
    // Regression guard for #884: the header is transformed while hidden, and a
    // transformed ancestor becomes the containing block for fixed descendants,
    // which collapses this fixed panel. Keep the panel as a sibling.
    expect(panel?.closest("header")).toBeNull()
  })
})
