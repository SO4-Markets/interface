import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { FaqSection } from "./faq-section"
import { LANDING_FAQS } from "./faq.generated"

describe("FaqSection", () => {
  it("renders every generated entry and reveals its documentation link", async () => {
    const user = userEvent.setup()
    render(<FaqSection />)
    for (const item of LANDING_FAQS) {
      expect(
        screen.getByRole("button", { name: item.question }),
      ).toBeInTheDocument()
    }
    await user.click(
      screen.getByRole("button", { name: LANDING_FAQS[0].question }),
    )
    expect(
      screen.getByRole("link", { name: LANDING_FAQS[0].linkLabel }),
    ).toHaveAttribute("href", `https://docs.so4.market${LANDING_FAQS[0].href}`)
  })

  it("keeps closed links inert through rapid keyboard toggles", async () => {
    const user = userEvent.setup()
    render(<FaqSection />)
    const trigger = screen.getByRole("button", { name: LANDING_FAQS[0].question })
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)

    trigger.focus()
    await user.keyboard("{Enter}{Enter}{Enter}")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(panel).not.toHaveAttribute("inert")
    await user.keyboard(" ")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(panel).toHaveAttribute("inert")
    expect(trigger).toHaveFocus()
  })
})
