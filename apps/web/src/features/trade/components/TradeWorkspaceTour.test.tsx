import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp"
import { TradeWorkspaceTour } from "./TradeWorkspaceTour"
import type { MobileTradeView } from "./MobileTradeNav"

const { motionPreference } = vi.hoisted(() => ({ motionPreference: { reduced: false } }))

vi.mock("@/lib/use-reduced-motion", () => ({
  useReducedMotion: () => motionPreference.reduced,
}))

function TourHarness({ onViewChange }: { onViewChange: (view: MobileTradeView) => void }) {
  const [replayKey, setReplayKey] = useState(0)
  return (
    <>
      <button data-tour-target="market-selector">Market selector</button>
      <div data-tour-target="order-form">Order form</div>
      <div data-tour-target="positions">Positions</div>
      <KeyboardShortcutsHelp onStartTour={() => setReplayKey((key) => key + 1)} />
      <TradeWorkspaceTour replayKey={replayKey} onViewChange={onViewChange} />
    </>
  )
}

describe("TradeWorkspaceTour", () => {
  const onViewChange = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    onViewChange.mockReset()
    motionPreference.reduced = false
  })

  afterEach(() => cleanup())

  it("guides first-run users through market, order form, and positions", async () => {
    render(<TourHarness onViewChange={onViewChange} />)

    expect(await screen.findByRole("dialog", { name: "Choose a market" })).toBeTruthy()
    await waitFor(() => expect(onViewChange).toHaveBeenLastCalledWith("chart"))

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("dialog", { name: "Build your order" })).toBeTruthy()
    await waitFor(() => expect(onViewChange).toHaveBeenLastCalledWith("trade"))

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("dialog", { name: "Manage positions" })).toBeTruthy()
    await waitFor(() => expect(onViewChange).toHaveBeenLastCalledWith("positions"))
  })

  it("dismisses with Escape and persists completion", async () => {
    render(<TourHarness onViewChange={onViewChange} />)
    expect(await screen.findByRole("dialog")).toBeTruthy()

    fireEvent.keyDown(document, { key: "Escape" })

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(localStorage.getItem("so4-trade-workspace-tour-v1-complete")).toBe("true")
  })

  it("replays from Help after first-run completion", async () => {
    localStorage.setItem("so4-trade-workspace-tour-v1-complete", "true")
    render(<TourHarness onViewChange={onViewChange} />)
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Help" }))
    fireEvent.click(await screen.findByRole("button", { name: "Replay workspace tour" }))

    expect(await screen.findByRole("dialog", { name: "Choose a market" })).toBeTruthy()
  })

  it("disables spotlight transitions when reduced motion is enabled", async () => {
    motionPreference.reduced = true
    render(<TourHarness onViewChange={onViewChange} />)

    expect(await screen.findByRole("dialog", { name: "Choose a market" })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByTestId("trade-tour-spotlight").getAttribute("style")).toContain("none")
    })
  })
})