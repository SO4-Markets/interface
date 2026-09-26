import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SocialSlider } from "./social-slider"

describe("SocialSlider", () => {
  it("presents each highlight once, without an automatic moving track", () => {
    const { container } = render(<SocialSlider />)

    for (const label of ["Self-custodied", "Unified liquidity", "Open source"]) {
      expect(screen.getAllByText(label)).toHaveLength(1)
    }
    expect(container.querySelector("[class*='animate-scroll']")).toBeNull()
  })
})
