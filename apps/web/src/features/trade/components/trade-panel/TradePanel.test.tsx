/**
 * TradePanel.test.tsx  (issue #226)
 *
 * Covers trade-input validation: invalid, zero, and excessive amounts each
 * disable the submit button (and surface a validation message), so a real
 * transaction is never initiated. Interactions use @testing-library/user-event.
 *
 * The real useTradeState hook is kept (so typing genuinely drives state and the
 * submit button's disabled logic); its data sources, the price/fee/balance
 * hooks, and the heavy child components are mocked for determinism.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ── Data sources behind the real useTradeState ───────────────────────────────
vi.mock("../../hooks/useMarkets", () => ({
  useMarkets: () => ({
    markets: [],
    getMarket: () => undefined,
    getMarketsForIndexToken: () => [],
  }),
}))
vi.mock("../../hooks/useTokenList", () => ({
  useTokenList: () => ({
    tokens: [],
    indexTokens: [],
    stableTokens: [],
    getToken: () => undefined,
  }),
}))

// ── Price / fee hooks ────────────────────────────────────────────────────────
vi.mock("../../hooks/useTokenPrices", () => ({
  useTokenPrices: () => ({
    prices: {},
    isLoading: false,
    error: null,
    getPrice: () => undefined,
    getMidPrice: () => 1,
  }),
}))
vi.mock("../../hooks/useTradeFees", () => ({
  useTradeFees: () => ({
    positionFeeUsd: 0,
    priceImpactUsd: 0,
    executionFeeUsd: 0,
    totalFeesUsd: 0,
    feesBreakdown: [],
  }),
}))
vi.mock("../../hooks/useMarketRiskParams", () => ({
  useMarketRiskParams: () => ({
    params: { maxLeverage: 50, maintenanceMarginRateBps: null, updatedAt: Date.now() },
    state: "available",
    isLoading: false,
    isError: false,
  }),
}))

// ── Wallet balances: USDC balance of 500 (the default collateral token) ──────
// Hoisted because the `vi.mock` factory below closes over it.
const { WALLET_BALANCE } = vi.hoisted(() => ({ WALLET_BALANCE: 500 }))
vi.mock("../../../wallet/hooks/useTokenBalances", () => ({
  useTokenBalances: () => ({ data: { USDC: WALLET_BALANCE } }),
}))

// ── Heavy children — irrelevant to input validation, and the dialog must never
//    submit a real transaction, so both are stubbed out. ──────────────────────
vi.mock("./TradeInfoRows", () => ({ TradeInfoRows: () => null }))
vi.mock("./ConfirmationDialog", () => ({ ConfirmationDialog: () => null }))

// ── Base UI wrappers — stubbed with pass-throughs (fast, and Base UI's Tabs /
//    Slider are prohibitively slow under happy-dom). ──────────────────────────
vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TabsContent: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) =>
    // Render only the default (Long) tab's content so a single input exists.
    value === "Long" ? <div>{children}</div> : null,
}))
vi.mock("@workspace/ui/components/slider", () => ({
  Slider: () => null,
}))
vi.mock("@workspace/ui/components/separator", () => ({
  Separator: () => <hr />,
}))
vi.mock("@workspace/ui/components/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

const { TradePanel } = await import("./TradePanel")
const { useTradeState } = await import("../../hooks/useTradeState")

/**
 * TradePanel takes the trade controller as a prop. These tests target the real
 * state machine (its data sources are mocked above), so drive it through the
 * actual hook rather than a hand-built stub.
 */
function TradePanelHarness() {
  const trade = useTradeState()
  return <TradePanel trade={trade} />
}

/** The pay/collateral amount input. */
function amountInput() {
  return screen.getByPlaceholderText("0.00")
}

/** The submit button (named e.g. "Long BTC", distinct from the "Long" tab). */
function submitButton() {
  return screen.getByRole("button", { name: /Long\s+BTC/i })
}

/** Whether the submit button is currently disabled. */
function submitDisabled(): boolean {
  return submitButton().hasAttribute("disabled")
}

beforeEach(() => {
  localStorage.clear() // ensure the default trade state (Long, empty amount)
})

afterEach(cleanup)

describe("TradePanel input validation (#226)", () => {
  it("disables submit while no amount is entered", () => {
    render(<TradePanelHarness />)
    expect(submitDisabled()).toBe(true)
  })

  it("rejects an invalid (negative) amount", async () => {
    const user = userEvent.setup()
    render(<TradePanelHarness />)

    await user.type(amountInput(), "-5")

    expect(screen.getByRole("alert").textContent).toBe("Enter a valid amount")
    expect(submitDisabled()).toBe(true)
  })

  it("rejects a zero amount", async () => {
    const user = userEvent.setup()
    render(<TradePanelHarness />)

    await user.type(amountInput(), "0")

    expect(screen.getByRole("alert").textContent).toBe("Enter a valid amount")
    expect(submitDisabled()).toBe(true)
  })

  it("rejects an excessive amount above the wallet balance", async () => {
    const user = userEvent.setup()
    render(<TradePanelHarness />)

    await user.type(amountInput(), String(WALLET_BALANCE + 1000))

    expect(screen.getByRole("alert").textContent).toBe("Insufficient balance")
    expect(submitDisabled()).toBe(true)
  })

  it("enables submit for a valid amount within balance", async () => {
    const user = userEvent.setup()
    render(<TradePanelHarness />)

    await user.type(amountInput(), "100")

    expect(screen.queryByRole("alert")).toBeNull()
    expect(submitDisabled()).toBe(false)
  })
})
