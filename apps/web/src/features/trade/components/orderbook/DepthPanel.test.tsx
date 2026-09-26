import { useEffect } from "react"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useOrderBookDisplayStore } from "../../store/orderbook-display-store"
import { DepthPanel } from "./DepthPanel"
import type { SourceHealth } from "../../hooks/useSourceHealth"
import type { BookLevel } from "../../lib/orderbook/book-reducer"
import type { MarketDisplayMetadata } from "../../lib/orderbook/display-prefs"

const BTC: MarketDisplayMetadata = {
  marketId: "BTC-USD",
  baseSymbol: "BTC",
  quoteSymbol: "USD",
  priceScale: 2,
  sizeScale: 4,
  tickSize: 1n,
}
const XLM: MarketDisplayMetadata = {
  marketId: "XLM-USD",
  baseSymbol: "XLM",
  quoteSymbol: "USD",
  priceScale: 5,
  sizeScale: 1,
  tickSize: 10n,
}

const L = (price: bigint, size: bigint): BookLevel => ({ price, size })

// 0.01 price atoms, 0.0001 size atoms.
const BIDS = [L(10_007n, 10_000n), L(10_005n, 20_000n), L(10_004n, 5_000n), L(9_996n, 30_000n)]
const ASKS = [L(10_008n, 10_000n), L(10_010n, 20_000n), L(10_013n, 5_000n), L(10_020n, 30_000n)]

const LIVE: SourceHealth = {
  status: "connected",
  lastUpdateTime: 1,
  staleDuration: null,
  reconnectAttempt: 0,
  isExecutable: true,
  message: "Live market data",
}

function priceCells(): Array<string> {
  return screen
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("cell").length > 0)
    .map((row) => within(row).getAllByRole("cell")[0].textContent)
}

beforeEach(() => {
  localStorage.clear()
  useOrderBookDisplayStore.setState({ layout: "both", byMarket: {} })
})

afterEach(cleanup)

describe("layouts (OB-053)", () => {
  it("both: asks above the spread worst-first, bids below best-first", () => {
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    expect(priceCells()).toEqual([
      "100.20", "100.13", "100.10", "100.08", // asks, best ask next to the spread
      "100.07", "100.05", "100.04", "99.96", // bids, best bid first
    ])
  })

  it("bids only: only bids, best-first", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={3} />)
    await user.click(screen.getByRole("radio", { name: "Show bids only" }))
    expect(priceCells()).toEqual(["100.07", "100.05", "100.04"])
  })

  it("asks only: only asks, still worst-first toward the spread", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={3} />)
    await user.click(screen.getByRole("radio", { name: "Show asks only" }))
    expect(priceCells()).toEqual(["100.13", "100.10", "100.08"])
  })

  it.each(["Show bids and asks", "Show bids only", "Show asks only"])(
    "%s keeps the market identity, the spread and the freshness badge visible",
    async (name) => {
      const user = userEvent.setup({ delay: null })
      render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={6} health={LIVE} />)
      await user.click(screen.getByRole("radio", { name }))

      expect(screen.getByRole("heading", { name: "BTC/USD" })).toBeInTheDocument()
      expect(screen.getByRole("separator", { name: "Spread" })).toHaveTextContent("0.01")
      expect(screen.getByText("Live")).toBeInTheDocument()
    },
  )

  it("exposes the layout controls with explicit accessible names", () => {
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={6} />)
    const group = screen.getByRole("radiogroup", { name: "Order book layout" })
    expect(within(group).getAllByRole("radio")).toHaveLength(3)
    // Each option is announced by its full action, not the short visible text.
    for (const name of ["Show bids and asks", "Show bids only", "Show asks only"]) {
      expect(within(group).getByRole("radio", { name })).toBeInTheDocument()
    }
  })

  it("the layout is reachable and changeable by keyboard alone", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={4} />)
    screen.getByRole("radio", { name: "Show bids and asks" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("radio", { name: "Show bids only" })).toBeChecked()
    expect(useOrderBookDisplayStore.getState().layout).toBe("bids")
  })

  it("preserves the selected grouping and unit across layouts", async () => {
    const user = userEvent.setup({ delay: null })
    useOrderBookDisplayStore.getState().setGrouping(BTC, 5)
    useOrderBookDisplayStore.getState().setUnit("BTC-USD", "quote")
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={6} />)

    await user.click(screen.getByRole("radio", { name: "Show bids only" }))
    await user.click(screen.getByRole("radio", { name: "Show bids and asks" }))

    // 0.05 grouping: asks round up (100.08 -> 100.10), bids round down (100.07 -> 100.05).
    expect(priceCells()).toContain("100.10")
    expect(priceCells()).toContain("100.05")
    expect(screen.getByRole("radio", { name: "Size in USD" })).toBeChecked()
    expect(screen.getByRole("table", { name: /size in USD/ })).toBeInTheDocument()
  })
})

describe("grouping (OB-052)", () => {
  it("aggregates rows to the chosen grouping using the exact fixtures", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)

    await user.click(screen.getByRole("combobox", { name: "Price grouping" }))
    await user.click(await screen.findByRole("option", { name: "0.05" }))

    await waitFor(() =>
      expect(priceCells()).toEqual([
        "100.20", "100.15", "100.10", // asks: 100.08+100.10 -> 100.10, 100.13 -> 100.15
        "100.05", "100.00", "99.95", // bids: 100.07+100.05 -> 100.05, 100.04 -> 100.00, 99.96 -> 99.95
      ]),
    )
  })

  it("does not change the spread, which comes from the canonical book", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    const before = screen.getByRole("separator", { name: "Spread" }).textContent

    await user.click(screen.getByRole("combobox", { name: "Price grouping" }))
    await user.click(await screen.findByRole("option", { name: "10" }))

    await waitFor(() => expect(useOrderBookDisplayStore.getState().byMarket["BTC-USD"]?.groupingMultiplier).toBe(1000))
    expect(screen.getByRole("separator", { name: "Spread" }).textContent).toBe(before)
  })

  it("does not modify the levels it was given", async () => {
    const bids = Object.freeze(BIDS.map((l) => Object.freeze({ ...l })))
    const asks = Object.freeze(ASKS.map((l) => Object.freeze({ ...l })))
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={bids} asks={asks} rows={8} />)
    await user.click(screen.getByRole("combobox", { name: "Price grouping" }))
    await user.click(await screen.findByRole("option", { name: "0.5" }))
    expect(bids).toEqual(BIDS)
    expect(asks).toEqual(ASKS)
  })

  it("offers groupings from the market's own tick size", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={XLM} bids={[L(12_340n, 100n)]} asks={[L(12_350n, 100n)]} rows={4} />)
    await user.click(screen.getByRole("combobox", { name: "Price grouping" }))
    const options = await screen.findAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual(["0.0001", "0.0002", "0.0005", "0.001", "0.005", "0.01", "0.05", "0.1"])
  })

  it("keeps each market's grouping when switching between markets", async () => {
    const user = userEvent.setup({ delay: null })
    const { rerender } = render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    await user.click(screen.getByRole("combobox", { name: "Price grouping" }))
    await user.click(await screen.findByRole("option", { name: "0.5" }))
    await waitFor(() => expect(useOrderBookDisplayStore.getState().byMarket["BTC-USD"]?.groupingMultiplier).toBe(50))

    rerender(<DepthPanel metadata={XLM} bids={[L(12_340n, 100n)]} asks={[L(12_350n, 100n)]} rows={4} />)
    expect(screen.getByRole("heading", { name: "XLM/USD" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Price grouping" })).toHaveTextContent("0.0001") // XLM untouched: native

    rerender(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    expect(screen.getByRole("combobox", { name: "Price grouping" })).toHaveTextContent("0.5")
  })

  it("resets a stored grouping the market stops offering", async () => {
    useOrderBookDisplayStore.getState().setGrouping(BTC, 100)
    const { rerender } = render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    expect(screen.getByRole("combobox", { name: "Price grouping" })).toHaveTextContent("1")

    // Precision metadata becomes unusable (capabilities change).
    rerender(<DepthPanel metadata={{ ...BTC, tickSize: 0n }} bids={BIDS} asks={ASKS} rows={8} />)
    await waitFor(() =>
      expect(useOrderBookDisplayStore.getState().byMarket["BTC-USD"]?.groupingMultiplier).toBe(1),
    )
  })
})

describe("units (OB-052)", () => {
  it("shows base sizes with the base symbol by default", () => {
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={2} />)
    expect(screen.getByRole("columnheader", { name: "Size (BTC)" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Size in BTC" })).toBeChecked()
  })

  it("switches to exact quote values and labels them in the quote symbol", async () => {
    const user = userEvent.setup({ delay: null })
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={2} />)
    await user.click(screen.getByRole("radio", { name: "Size in USD" }))

    expect(screen.getByRole("columnheader", { name: "Size (USD)" })).toBeInTheDocument()
    // Best bid: 100.07 * 1.0000 BTC = 100.07 USD.
    const bidRow = screen.getAllByRole("row").at(-1)!
    expect(within(bidRow).getAllByRole("cell")[1]).toHaveTextContent("100.07")
  })

  it("the unit is remembered per market", async () => {
    const user = userEvent.setup({ delay: null })
    const { rerender } = render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={2} />)
    await user.click(screen.getByRole("radio", { name: "Size in USD" }))

    rerender(<DepthPanel metadata={XLM} bids={[L(12_340n, 100n)]} asks={[L(12_350n, 100n)]} rows={2} />)
    expect(screen.getByRole("radio", { name: "Size in XLM" })).toBeChecked()
    rerender(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={2} />)
    expect(screen.getByRole("radio", { name: "Size in USD" })).toBeChecked()
  })
})

describe("stability while the feed is live (OB-053)", () => {
  it("rapid layout, grouping and unit switches never remount the feed that owns the levels", async () => {
    let mounts = 0
    let unmounts = 0
    function Feed() {
      // Stands in for the component that holds the live subscription.
      useEffect(() => {
        mounts++
        return () => {
          unmounts++
        }
      }, [])
      return <DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={6} health={LIVE} />
    }
    const user = userEvent.setup({ delay: null })
    render(<Feed />)

    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("radio", { name: "Show bids only" }))
      await user.click(screen.getByRole("radio", { name: "Show asks only" }))
      await user.click(screen.getByRole("radio", { name: "Show bids and asks" }))
      await user.click(screen.getByRole("radio", { name: "Size in USD" }))
      await user.click(screen.getByRole("radio", { name: "Size in BTC" }))
    }

    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
    expect(screen.getByRole("heading", { name: "BTC/USD" })).toBeInTheDocument()
  }, 20_000)

  it("keeps the same DOM nodes for rows that persist across a book update", () => {
    const { rerender } = render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    const rows = () => screen.getAllByRole("row")
    const beforeRow = rows().find((r) => r.textContent.startsWith("100.07"))!

    // A new update: same levels plus one more bid deeper in the book.
    rerender(<DepthPanel metadata={BTC} bids={[...BIDS, L(9_990n, 1_000n)]} asks={ASKS} rows={8} />)

    const afterRow = rows().find((r) => r.textContent.startsWith("100.07"))!
    expect(afterRow).toBe(beforeRow)
  })

  it("does not animate row movement or fills (no transitions on the ladder)", () => {
    render(<DepthPanel metadata={BTC} bids={BIDS} asks={ASKS} rows={8} />)
    // The ladder itself; the shared select and radio controls carry their own focus styling.
    const ladder = screen.getByRole("table")
    for (const el of [ladder, ...Array.from(ladder.querySelectorAll("*"))]) {
      expect(el.className.toString()).not.toMatch(/transition|animate|duration/)
    }
  })
})

describe("unusable market metadata", () => {
  it("explains why depth is unavailable and disables the precision controls", () => {
    render(<DepthPanel metadata={{ ...BTC, tickSize: 0n }} bids={BIDS} asks={ASKS} rows={6} />)
    expect(screen.getByText(/precision is unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Price grouping" })).toBeDisabled()
    expect(screen.queryAllByRole("row")).toHaveLength(0)
  })

  it("handles no metadata at all", () => {
    render(<DepthPanel metadata={null} bids={[]} asks={[]} rows={6} />)
    expect(screen.getByRole("heading", { name: "Market unavailable" })).toBeInTheDocument()
  })
})

describe("empty and crossed books", () => {
  it("says there is no depth to show", () => {
    render(<DepthPanel metadata={BTC} bids={[]} asks={[]} rows={6} />)
    expect(screen.getByText("No depth to show.")).toBeInTheDocument()
    expect(screen.getByRole("separator", { name: "Spread" })).toHaveTextContent("—")
  })

  it("marks a crossed book instead of showing a negative spread", () => {
    render(<DepthPanel metadata={BTC} bids={[L(10_010n, 1n)]} asks={[L(10_000n, 1n)]} rows={4} />)
    expect(screen.getByRole("separator", { name: "Spread" })).toHaveTextContent("crossed")
  })
})
