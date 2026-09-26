import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MarketSelector } from "./MarketSelector"
import type { MarketItem } from "./MarketSelector"

const FIXTURE_MARKETS: Array<MarketItem> = [
  { id: "addr-btc", name: "BTC/USD" },
  { id: "addr-eth", name: "ETH/USD" },
  { id: "addr-xlm", name: "XLM/USD" },
]

function setup(activeMarketId?: string, markets = FIXTURE_MARKETS) {
  const onSelect = vi.fn()
  render(
    <MarketSelector
      markets={markets}
      activeMarketId={activeMarketId}
      onSelect={onSelect}
    />,
  )
  return { onSelect }
}

describe("MarketSelector", () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  // ── Closed state ─────────────────────────────────────────────────────────

  it("shows 'Select Market' trigger when no active market is set", () => {
    setup()
    expect(screen.getByRole("button", { name: "Select Market" })).toBeInTheDocument()
  })

  it("shows the active market name in the trigger", () => {
    setup("addr-btc")
    expect(screen.getByRole("button", { name: "BTC/USD" })).toBeInTheDocument()
  })

  it("does not render the search input while the dropdown is closed", () => {
    setup()
    expect(screen.queryByPlaceholderText("Search markets...")).not.toBeInTheDocument()
  })

  // ── Opening ───────────────────────────────────────────────────────────────

  it("opens the dropdown and shows the search input on trigger click", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    expect(screen.getByPlaceholderText("Search markets...")).toBeInTheDocument()
  })

  it("renders all fixture markets when the dropdown opens", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    expect(screen.getByRole("option", { name: "BTC/USD" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "ETH/USD" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "XLM/USD" })).toBeInTheDocument()
  })

  // ── Search / filtering ────────────────────────────────────────────────────

  it("filters markets to only those matching the typed query", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.type(screen.getByRole("textbox"), "BTC")
    expect(screen.getByRole("option", { name: "BTC/USD" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "ETH/USD" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "XLM/USD" })).not.toBeInTheDocument()
  })

  it("is case-insensitive when filtering", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.type(screen.getByRole("textbox"), "eth")
    expect(screen.getByRole("option", { name: "ETH/USD" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "BTC/USD" })).not.toBeInTheDocument()
  })

  it("shows 'No markets found' when the query has no match", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.type(screen.getByRole("textbox"), "DOGE")
    expect(screen.getByText("No markets found")).toBeInTheDocument()
  })

  // ── Selection ─────────────────────────────────────────────────────────────

  it("calls onSelect with the correct market id when a market is clicked", async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.click(screen.getByRole("option", { name: "ETH/USD" }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith("addr-eth")
  })

  it("calls onSelect with the correct id for a different market", async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.click(screen.getByRole("option", { name: "BTC/USD" }))
    expect(onSelect).toHaveBeenCalledWith("addr-btc")
  })

  it("closes the dropdown after a market is selected", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.click(screen.getByRole("option", { name: "BTC/USD" }))
    expect(screen.queryByPlaceholderText("Search markets...")).not.toBeInTheDocument()
  })

  // ── Keyboard / closing ────────────────────────────────────────────────────

  it("closes the dropdown when Escape is pressed", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByPlaceholderText("Search markets...")).not.toBeInTheDocument()
  })

  it("returns focus to the trigger after Escape closes the listbox", async () => {
    const user = userEvent.setup()
    setup("addr-btc")
    const trigger = screen.getByRole("button", { name: "BTC/USD" })
    await user.click(trigger)
    expect(screen.getByRole("listbox", { name: "Markets" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(trigger).toHaveFocus()
  })

  // ── Disabled markets ──────────────────────────────────────────────────────

  it("filters out disabled markets from the list", async () => {
    const user = userEvent.setup()
    const disabledMarkets: Array<MarketItem> = [
      { id: "addr-btc", name: "BTC/USD" },
      { id: "addr-eth", name: "ETH/USD", disabled: true },
      { id: "addr-xlm", name: "XLM/USD" },
    ]
    setup(undefined, disabledMarkets)
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    expect(screen.getByRole("option", { name: "BTC/USD" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "XLM/USD" })).toBeInTheDocument()
    // ETH is disabled, so it shouldn't appear in the list
    expect(screen.queryByRole("option", { name: "ETH/USD" })).not.toBeInTheDocument()
  })

  it("searches by name and address", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Select Market" }))
    await user.type(screen.getByRole("textbox"), "addr-btc")
    expect(screen.getByRole("option", { name: "BTC/USD" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "XLM/USD" })).not.toBeInTheDocument()
  })

  it("handles empty markets array gracefully", () => {
    setup(undefined, [])
    expect(screen.getByRole("button", { name: "Select Market" })).toBeInTheDocument()
  })
})
