import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { LiquidationWarningAnnouncer } from "./LiquidationWarningAnnouncer"
import type { LiquidationWatchPosition } from "../lib/trade-announcements"

const safe: LiquidationWatchPosition = {
  key: "btc-long",
  marketName: "BTC/USD",
  isLong: true,
  sizeUsd: 10_000,
  markPrice: 100,
  liquidationPrice: 80,
}

describe("LiquidationWarningAnnouncer (issue 956)", () => {
  afterEach(cleanup)

  it("mounts an empty assertive live region before any warning", async () => {
    const { container } = render(<LiquidationWarningAnnouncer positions={[safe]} />)
    const region = screen.getByTestId("liquidation-announcer")
    expect(region).toHaveAttribute("aria-live", "assertive")
    expect(region).toHaveAttribute("role", "alert")
    expect(region).toHaveTextContent("")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("announces when a position crosses into the danger band, once", () => {
    const { rerender } = render(<LiquidationWarningAnnouncer positions={[safe]} />)
    const danger = { ...safe, markPrice: 84 }

    rerender(<LiquidationWarningAnnouncer positions={[danger]} />)
    const region = screen.getByTestId("liquidation-announcer")
    expect(region.textContent).toContain("Liquidation warning: BTC/USD long is 4.8%")
    const spoken = region.textContent

    rerender(<LiquidationWarningAnnouncer positions={[{ ...danger }]} />)
    expect(region.textContent).toBe(spoken)
  })
})
