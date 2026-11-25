import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { Button } from "../button"
import { EmptyState } from "../empty-state"
import { Meter } from "../meter"
import { ProgressIndicator } from "../progress-indicator"
import { RollingNumber } from "../rolling-number"
import { Switch } from "../switch"
import { TransactionStatus } from "../transaction-status"

/**
 * Reduced-motion contract for shared components (#1057).
 *
 * jsdom does not evaluate media queries, so the contract is checked on the
 * classes a component renders: every motion utility must be paired with a
 * reduced-motion alternative, or be gated behind `motion-safe:`. A bare
 * `animate-spin` next to `motion-safe:animate-spin` (the old Button spinner)
 * keeps spinning for people who asked it to stop.
 */

const UNGATED_ANIMATION = /^(animate-(spin|pulse|ping|bounce|in|out))$/
const MOTION_TRANSITION = /^transition-(transform|opacity|\[[^\]]*(transform|width|opacity)[^\]]*\])$/

function classTokens(element: Element): Array<string> {
  const value = element.getAttribute("class") ?? ""
  return value.split(/\s+/).filter(Boolean)
}

function motionViolations(container: Element): Array<string> {
  const violations: Array<string> = []
  for (const element of [container, ...Array.from(container.querySelectorAll("*"))]) {
    const tokens = classTokens(element)
    for (const token of tokens) {
      if (UNGATED_ANIMATION.test(token) && !tokens.includes("motion-reduce:animate-none")) {
        violations.push(`${token} has no reduced-motion alternative`)
      }
      if (MOTION_TRANSITION.test(token) && !tokens.includes("motion-reduce:transition-none")) {
        violations.push(`${token} has no reduced-motion alternative`)
      }
    }
  }
  return violations
}

describe("shared component reduced-motion contract", () => {
  it("gates the pending Button spinner and keeps the busy state visible", () => {
    const { container, getByRole } = render(<Button pending>Submit</Button>)
    expect(motionViolations(container)).toEqual([])
    const spinner = container.querySelector("span[aria-hidden='true']")
    expect(spinner).toHaveClass("motion-safe:animate-spin")
    // Without motion the spinner is a static ring; the busy state still reads.
    expect(spinner).toHaveClass("border-t-transparent")
    expect(getByRole("button")).toHaveAttribute("aria-busy", "true")
  })

  it.each(["signing", "submitting", "confirming"] as const)(
    "gates the %s transaction spinner but keeps its status text",
    (status) => {
      const { container } = render(<TransactionStatus state={{ status, label: `Now ${status}` }} />)
      expect(motionViolations(container)).toEqual([])
      expect(container.querySelector(".motion-safe\\:animate-spin")).not.toBeNull()
      expect(container).toHaveTextContent(`Now ${status}`)
    }
  )

  it("snaps meter and progress fills to their value", () => {
    const meter = render(<Meter value={40} label="Utilisation" />)
    expect(motionViolations(meter.container)).toEqual([])
    meter.unmount()

    const progress = render(<ProgressIndicator value={40} label="Upload" />)
    expect(motionViolations(progress.container)).toEqual([])
  })

  it("rolls number digits only when motion is allowed", () => {
    const { container } = render(<RollingNumber value="$1,234.56" />)
    expect(container.querySelector(".transition-transform")).not.toBeNull()
    expect(motionViolations(container)).toEqual([])
  })

  it("moves the switch thumb without a slide under reduced motion", () => {
    const { container } = render(<Switch aria-label="Expert mode" />)
    expect(motionViolations(container)).toEqual([])
  })

  it("enters empty states with motion tokens and no zoom under reduced motion", () => {
    const { container } = render(
      <EmptyState icon={<svg aria-hidden="true" />} title="No positions" description="Open a trade to start." />
    )
    expect(motionViolations(container)).toEqual([])
    const animated = Array.from(container.querySelectorAll(".animate-in"))
    expect(animated.length).toBeGreaterThan(0)
    for (const element of [container.firstElementChild!, ...animated]) {
      const tokens = classTokens(element).filter((t) => t.startsWith("duration-"))
      for (const token of tokens) {
        expect(token).toMatch(/^duration-(fast|base|moderate|slow|slowest)$/)
      }
    }
  })
})

describe("menu and listbox popups under reduced motion", () => {
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8")

  it.each(["select-content", "dropdown-menu-content"])(
    "keeps the %s fade but removes zoom and slide for both preferences",
    (slot) => {
      const neutralised = [
        "--tw-enter-scale: 1",
        "--tw-exit-scale: 1",
        "--tw-enter-translate-x: 0",
        "--tw-enter-translate-y: 0",
        "--tw-exit-translate-x: 0",
        "--tw-exit-translate-y: 0",
      ]
      const system = stylesheet.match(
        new RegExp(
          String.raw`@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\[data-slot="${slot}"\][^}]*\{([^}]*)\}`
        )
      )
      const app = stylesheet.match(
        new RegExp(String.raw`:root\[data-reduced-motion="true"\] \[data-slot="${slot}"\][^{]*\{([^}]*)\}`)
      )
      for (const block of [system?.[1], app?.[1]]) {
        expect(block).toBeDefined()
        for (const declaration of neutralised) expect(block).toContain(declaration)
        // Opacity is left alone so open and close still read as a state change.
        expect(block).not.toMatch(/opacity|animation:\s*none/)
      }
    }
  )
})
