import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { MarketSelector } from "./MarketSelector"

const state = vi.hoisted(() => ({ loading: false }))
vi.mock("../../hooks/useMarkets", () => ({
  useMarkets: () => ({ isLoading: state.loading, markets: [
    { name: "BTC/USD", address: "btc-usd", indexTokenAddress: "btc" },
    { name: "ETH/USD", address: "eth-usd", indexTokenAddress: "eth" },
  ] }),
}))
vi.mock("../../hooks/useTokenPrices", () => ({ useTokenPrices: () => ({ getMidPrice: () => 0 }) }))
vi.mock("../../hooks/usePriceDelta24h", () => ({ usePriceDelta24h: () => ({}) }))
afterEach(() => { cleanup(); localStorage.clear(); state.loading = false })

it("saves a keyboard-highlighted market and remembers selections across mounts", async () => {
  const user = userEvent.setup()
  const select = vi.fn()
  const view = render(<MarketSelector onSelect={select} symbol={undefined} />)
  await user.click(screen.getByRole("button", { name: "Select Market" }))
  screen.getByRole("combobox").focus()
  await user.keyboard("{ArrowDown}")
  await user.click(screen.getByRole("button", { name: "Add ETH/USD to watchlist" }))
  await user.click(screen.getByRole("button", { name: "Watchlist" }))
  expect(screen.getAllByRole("option")).toHaveLength(1)
  await user.keyboard("{Enter}")
  expect(select).toHaveBeenCalledWith("eth")
  view.unmount()
  render(<MarketSelector onSelect={select} symbol={undefined} />)
  await user.click(screen.getByRole("button", { name: "Select Market" }))
  await user.click(screen.getByRole("button", { name: "Recent markets" }))
  expect(screen.getByRole("option", { name: /ETH/ })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Remove ETH/USD from watchlist" }))
  await user.click(screen.getByRole("button", { name: "Watchlist" }))
  expect(screen.getByText("Your watchlist is empty")).toBeVisible()
})

it("allows disconnected browsing and announces loading", async () => {
  state.loading = true
  render(<MarketSelector onSelect={vi.fn()} symbol={undefined} />)
  await userEvent.click(screen.getByRole("button", { name: "Select Market" }))
  expect(screen.getByRole("status")).toHaveTextContent("Loading markets")
  expect(screen.getByText(/Wallet disconnected/)).toBeVisible()
})
