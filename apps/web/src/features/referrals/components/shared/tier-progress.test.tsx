import { describe, it, expect, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { TierProgress } from "./tier-progress"

afterEach(cleanup)

describe("TierProgress", () => {
  describe("zero volume (Bronze, no progress toward Silver)", () => {
    it("renders current tier label", () => {
      render(<TierProgress tier={1} volumeUsd={0} />)
      expect(screen.getAllByText("Bronze").length).toBeGreaterThan(0)
    })

    it("renders next tier label", () => {
      render(<TierProgress tier={1} volumeUsd={0} />)
      expect(screen.getAllByText("Silver").length).toBeGreaterThan(0)
    })

    it("renders progress bar at 0%", () => {
      render(<TierProgress tier={1} volumeUsd={0} />)
      const bar = screen.getByRole("progressbar")
      expect(bar).toHaveAttribute("aria-valuenow", "0")
    })

    it("renders remaining threshold copy", () => {
      render(<TierProgress tier={1} volumeUsd={0} />)
      expect(screen.getByLabelText("remaining volume")).toHaveTextContent("more needed")
    })
  })

  describe("partial progress (Bronze → Silver at 50%)", () => {
    it("renders both tier labels", () => {
      render(<TierProgress tier={1} volumeUsd={1250} />)
      expect(screen.getAllByText("Bronze").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Silver").length).toBeGreaterThan(0)
    })

    it("renders progressbar at 50", () => {
      render(<TierProgress tier={1} volumeUsd={1250} />)
      const bar = screen.getByRole("progressbar")
      expect(bar).toHaveAttribute("aria-valuenow", "50")
    })

    it("shows next-tier threshold copy", () => {
      render(<TierProgress tier={1} volumeUsd={1250} />)
      expect(screen.getByLabelText("remaining volume")).toHaveTextContent("more needed")
    })
  })

  describe("maxed-out tier (Gold, level 3)", () => {
    it("renders current tier label", () => {
      render(<TierProgress tier={3} volumeUsd={50000} />)
      expect(screen.getAllByText("Gold").length).toBeGreaterThan(0)
    })

    it("renders maximum tier message", () => {
      render(<TierProgress tier={3} volumeUsd={50000} />)
      expect(screen.getByText("Maximum tier reached!")).toBeInTheDocument()
    })

    it("does not render a progress bar", () => {
      render(<TierProgress tier={3} volumeUsd={50000} />)
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })

    it("does not render 'more needed' copy", () => {
      render(<TierProgress tier={3} volumeUsd={50000} />)
      expect(screen.queryByLabelText("remaining volume")).not.toBeInTheDocument()
    })
  })

  describe("tier label correctness", () => {
    it("Silver → Gold shows correct labels", () => {
      render(<TierProgress tier={2} volumeUsd={5000} />)
      expect(screen.getAllByText("Silver").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Gold").length).toBeGreaterThan(0)
    })
  })

  describe("progressbar aria attributes", () => {
    it("has aria-valuemin=0 and aria-valuemax=100", () => {
      render(<TierProgress tier={1} volumeUsd={500} />)
      const bar = screen.getByRole("progressbar")
      expect(bar).toHaveAttribute("aria-valuemin", "0")
      expect(bar).toHaveAttribute("aria-valuemax", "100")
    })

    it("caps aria-valuenow at 100 when volume exceeds threshold", () => {
      render(<TierProgress tier={1} volumeUsd={999999} />)
      const bar = screen.getByRole("progressbar")
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(100)
    })
  })
})
