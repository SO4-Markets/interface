import { describe, expect, it, vi } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion"

function ExampleAccordion({
  type = "single",
}: {
  type?: "single" | "multiple"
}) {
  const content = (
    <>
      <AccordionItem value="first">
        <AccordionTrigger headingLevel={2}>First question</AccordionTrigger>
        <AccordionContent>First answer</AccordionContent>
      </AccordionItem>
      <AccordionItem value="second">
        <AccordionTrigger headingLevel={2}>Second question</AccordionTrigger>
        <AccordionContent>Second answer</AccordionContent>
      </AccordionItem>
    </>
  )

  if (type === "multiple") {
    return (
      <Accordion type="multiple" defaultValue={["first"]}>
        {content}
      </Accordion>
    )
  }

  return (
    <Accordion type="single" defaultValue="first">
      {content}
    </Accordion>
  )
}

describe("Accordion", () => {
  it("renders triggers as real buttons inside semantic headings", () => {
    render(<ExampleAccordion />)

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "First question",
    })

    expect(
      within(heading).getByRole("button", { name: "First question" })
    ).toBeInTheDocument()
  })

  it("connects content ids and expanded state programmatically", () => {
    render(<ExampleAccordion />)

    const trigger = screen.getByRole("button", { name: "First question" })
    const contentId = trigger.getAttribute("aria-controls")
    const content = document.getElementById(contentId ?? "")

    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(content).toHaveAttribute("role", "region")
    expect(content).toHaveAttribute("aria-labelledby", trigger.id)
    expect(content).toHaveAttribute("aria-hidden", "false")
  })

  it("removes focusable content in a closed panel from the tab order", () => {
    // Regression: aria-hidden alone hides the panel from assistive tech but
    // doesn't stop a sighted keyboard user from tabbing into a link inside
    // it — WCAG 4.1.2. `inert` must make it genuinely unfocusable too.
    render(
      <Accordion type="single" defaultValue="first">
        <AccordionItem value="first">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>
            <a href="#first">Link in the open panel</a>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="second">
          <AccordionTrigger>Second question</AccordionTrigger>
          <AccordionContent>
            <a href="#second">Link in the closed panel</a>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const openLink = screen.getByRole("link", {
      name: "Link in the open panel",
    })
    const closedLink = screen.queryByRole("link", {
      name: "Link in the closed panel",
    })

    // The open panel's link stays in the accessibility tree and tab order.
    expect(openLink).toBeVisible()
    // The closed panel's link is inert: not exposed as a link (removed from
    // the a11y tree) and not focusable, even though it's still in the DOM.
    expect(closedLink).not.toBeInTheDocument()
  })

  it("keeps only one item open in single mode", async () => {
    const user = userEvent.setup()
    render(<ExampleAccordion />)

    const first = screen.getByRole("button", { name: "First question" })
    const second = screen.getByRole("button", { name: "Second question" })

    expect(first).toHaveAttribute("aria-expanded", "true")
    expect(second).toHaveAttribute("aria-expanded", "false")

    await user.click(second)

    expect(first).toHaveAttribute("aria-expanded", "false")
    expect(second).toHaveAttribute("aria-expanded", "true")
  })

  it("uses the latest state for toggles delivered in one batch", () => {
    render(
      <Accordion type="single">
        <AccordionItem value="first">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>First answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole("button", { name: "First question" })
    act(() => {
      trigger.click()
      trigger.click()
      trigger.click()
    })

    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("allows multiple items to stay open in multiple mode", async () => {
    const user = userEvent.setup()
    render(<ExampleAccordion type="multiple" />)

    const first = screen.getByRole("button", { name: "First question" })
    const second = screen.getByRole("button", { name: "Second question" })

    await user.click(second)

    expect(first).toHaveAttribute("aria-expanded", "true")
    expect(second).toHaveAttribute("aria-expanded", "true")
  })

  it("supports controlled single state", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <Accordion type="single" value="first" onValueChange={onValueChange}>
        <AccordionItem value="first">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>First answer</AccordionContent>
        </AccordionItem>
        <AccordionItem value="second">
          <AccordionTrigger>Second question</AccordionTrigger>
          <AccordionContent>Second answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    await user.click(screen.getByRole("button", { name: "Second question" }))

    expect(onValueChange).toHaveBeenCalledWith("second")
    expect(
      screen.getByRole("button", { name: "First question" })
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("supports controlled multiple state", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <Accordion
        type="multiple"
        value={["first"]}
        onValueChange={onValueChange}
      >
        <AccordionItem value="first">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>First answer</AccordionContent>
        </AccordionItem>
        <AccordionItem value="second">
          <AccordionTrigger>Second question</AccordionTrigger>
          <AccordionContent>Second answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    await user.click(screen.getByRole("button", { name: "Second question" }))

    expect(onValueChange).toHaveBeenCalledWith(["first", "second"])
  })

  it("does not toggle disabled items", async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="single">
        <AccordionItem value="disabled" disabled>
          <AccordionTrigger>Disabled question</AccordionTrigger>
          <AccordionContent>Disabled answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole("button", { name: "Disabled question" })
    await user.click(trigger)

    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("supports sequential keyboard navigation, Space, and Enter", async () => {
    const user = userEvent.setup()
    render(
      <Accordion type="multiple">
        <AccordionItem value="first">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>First answer</AccordionContent>
        </AccordionItem>
        <AccordionItem value="second">
          <AccordionTrigger>Second question</AccordionTrigger>
          <AccordionContent>Second answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const first = screen.getByRole("button", { name: "First question" })
    const second = screen.getByRole("button", { name: "Second question" })

    await user.tab()
    expect(first).toHaveFocus()
    await user.keyboard(" ")
    expect(first).toHaveAttribute("aria-expanded", "true")

    await user.tab()
    expect(second).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(second).toHaveAttribute("aria-expanded", "true")
  })

  it("uses motion-reduce classes on animated parts", () => {
    render(<ExampleAccordion />)

    expect(screen.getByRole("region", { name: "First question" })).toHaveClass(
      "motion-reduce:transition-none"
    )
  })
})
