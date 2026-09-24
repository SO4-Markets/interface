import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ComponentProps } from "react"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}))

vi.mock("./use-landing-stats", () => ({
  useLandingStats: () => ({ traders: null, openInterest: null, totalVolume: null }),
}))

// AnimatedTitle reads matchMedia while rendering, so the hero cannot mount
// without a stub — this is the same stub the sibling animated-title test uses.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

// The sequence flag is module-scoped, so every test needs a fresh module or the
// tests pass for the wrong reason: the first mount in the file would set the
// flag and the later ones would assert against an empty set of elements.
afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

async function renderHero() {
  const { HeroSection } = await import("./hero-section")
  return render(<HeroSection />)
}

describe("HeroSection first-load sequence", () => {
  it("sequences the secondary content and the decorative accent", async () => {
    const { container } = await renderHero()

    expect(container.querySelectorAll("[class*='animate-hero-rise']")).toHaveLength(3)
    expect(container.querySelectorAll("[class*='animate-hero-fade']")).toHaveLength(1)
  })

  it("leaves the primary content out of the sequence", async () => {
    const { container } = await renderHero()

    const heading = container.querySelector("h1")
    expect(heading).not.toBeNull()
    expect(heading?.className).not.toMatch(/animate-hero/)

    const tradeAction = screen.getByRole("link", { name: "Trade now" })
    expect(tradeAction.className).not.toMatch(/animate-hero/)
  })

  it("does not replay the sequence on a later mount in the same page load", async () => {
    const first = await renderHero()
    first.unmount()

    const second = await renderHero()
    expect(second.container.querySelectorAll("[class*='animate-hero']")).toHaveLength(0)
  })

  it("carries the motion-safe prefix, so reduced motion skips the whole sequence", async () => {
    const { container } = await renderHero()

    const animated = Array.from(container.querySelectorAll("[class*='animate-hero']"))
    expect(animated).toHaveLength(4)

    for (const element of animated) {
      expect(element.className).toMatch(/motion-safe:animate-hero/)
    }
  })
})
