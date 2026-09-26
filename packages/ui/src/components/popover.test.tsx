import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

describe("Popover trigger-following motion (OB-016)", () => {
  it("applies origin-(--transform-origin) and side-aware animation classes", () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="popover-content">
          Popover body
        </PopoverContent>
      </Popover>
    )

    const content = screen.getByTestId("popover-content")
    expect(content.className).toContain("origin-(--transform-origin)")
    expect(content.className).toContain("data-open:animate-in")
    expect(content.className).toContain("data-[side=bottom]:slide-in-from-top-2")
  })
})
