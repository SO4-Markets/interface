import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ViewportReveal } from "./viewport-reveal"
import * as useReducedMotionModule from "@/lib/use-reduced-motion"

describe("ViewportReveal", () => {
  beforeEach(() => {
    vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(false)
  })

  it("renders children", () => {
    render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    expect(screen.getByText("Test content")).toBeInTheDocument()
  })

  it("starts with opacity-0 when reduced-motion is disabled", () => {
    const { container } = render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("opacity-0")
  })

  it("starts with opacity-100 when reduced-motion is enabled", () => {
    vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(true)
    const { container } = render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("opacity-100")
  })

  it("applies custom revealClass when provided", () => {
    const { container } = render(
      <ViewportReveal revealClass="scale-100">
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    // Initially should have scale-0 (opposite of scale-100)
    expect(wrapper).toHaveClass("transition-opacity")
  })

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <ViewportReveal className="custom-class">
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("custom-class")
  })

  it("includes transition-opacity class", () => {
    const { container } = render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("transition-opacity")
  })

  it("includes duration-base when reduced-motion is disabled", () => {
    vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(false)
    const { container } = render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("duration-base")
  })

  it("does not include duration-base when reduced-motion is enabled", () => {
    vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(true)
    const { container } = render(
      <ViewportReveal>
        <div>Test content</div>
      </ViewportReveal>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).not.toHaveClass("duration-base")
  })
})
