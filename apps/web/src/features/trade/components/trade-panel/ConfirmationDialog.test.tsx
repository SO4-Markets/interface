/**
 * ConfirmationDialog.test.tsx  (issue #227)
 *
 * Verifies the confirmation dialog renders the order summary and wires the
 * Confirm / Cancel callbacks. Uses semantic assertions (label→value lookups,
 * roles, accessible names) — no snapshots.
 *
 * The dialog transitively imports the Soroban transaction layer (which loads
 * config/env.ts and would throw without a full env, and must never fire a real
 * transaction). Those modules are replaced with mocks; the pure formatting and
 * pricing helpers are kept real so the assertions exercise production output.
 * The heavy Base UI <Dialog> is stubbed with pass-through elements for speed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { formatUsd } from "../../lib/trade-math"

// `vi.mock` factories are hoisted above module-level declarations, so anything
// they close over has to be created inside `vi.hoisted` to avoid a TDZ error.
const { wallet, TOTAL_FEES_USD, createSwapOrder, sendBatchOrderTxn } = vi.hoisted(
  () => ({
    // Mutable holder so `beforeEach` can reset the connected account.
    wallet: {
      address: "GTESTACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
    TOTAL_FEES_USD: 12.34,
    createSwapOrder: vi.fn(() => Promise.resolve({})),
    sendBatchOrderTxn: vi.fn(() => Promise.resolve({})),
  })
)

// ── Wallet: a connected account so the confirm path runs the order flow ──────
vi.mock("@/features/wallet/store/wallet-store", () => ({
  useWalletStore: <T,>(selector: (state: { address: string | null }) => T): T =>
    selector({ address: wallet.address }),
}))

// ── Fees: fixed, deterministic ───────────────────────────────────────────────
vi.mock("../../hooks/useTradeFees", () => ({
  useTradeFees: () => ({
    positionFeeUsd: 0,
    priceImpactUsd: 0,
    executionFeeUsd: 0,
    totalFeesUsd: TOTAL_FEES_USD,
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

// ── Transaction layer: mocked so no real transaction is ever submitted ───────
vi.mock("../../lib/stellar", () => ({ createSwapOrder, sendBatchOrderTxn }))

vi.mock("@/lib/soroban/simulate", () => ({
  estimateFee: vi.fn(() => Promise.resolve({ total: "0.5" })),
}))
vi.mock("@/lib/contracts/exchange-router-client", () => ({
  buildCreateOrderTransaction: vi.fn(() => Promise.resolve({})),
  buildBatchOrderTransaction: vi.fn(() => Promise.resolve({})),
}))
vi.mock("../../lib/order-encoding", () => ({
  toCreateOrderParams: (o: unknown) => o,
  toDecreaseOrderParams: (o: unknown) => o,
}))

// ── Base UI dialog: lightweight stand-ins (render children when open) ─────────
vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

const { ConfirmationDialog } = await import("./ConfirmationDialog")

// ── Fixed order fixture: a 10x Long on BTC, collateral in USDC ───────────────
const SIZE_USD = 5000
const ENTRY_PRICE = 50_000
const LIQUIDATION_PRICE = 45_000

function makeTradeState() {
  return {
    tradeType: "Long",
    tradeMode: "Market",
    fromTokenAddress: "USDC",
    toTokenAddress: "BTC",
    marketAddress: "BTC-BTC-USDC",
    collateralAddress: "USDC",
    fromAmount: "1000",
    triggerPrice: "",
    leverage: 10,
    sidecarOrders: [],
    clearSidecarOrders: vi.fn(() => {}),
    tradeFlags: {
      isLong: true,
      isShort: false,
      isSwap: false,
      isPosition: true,
      isMarket: true,
      isLimit: false,
      isTrigger: false,
    },
  }
}

type DialogProps = React.ComponentProps<typeof ConfirmationDialog>

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const onClose = vi.fn(() => {})
  render(
    <ConfirmationDialog
      open
      onClose={onClose}
      tradeState={makeTradeState() as unknown as DialogProps["tradeState"]}
      sizeUsd={SIZE_USD}
      entryPrice={ENTRY_PRICE}
      liquidationPrice={LIQUIDATION_PRICE}
      totalFeesUsd={TOTAL_FEES_USD}
      {...overrides}
    />
  )
  return { onClose }
}

/** Read the value rendered next to a summary row label. */
function rowValue(label: string): string {
  const labelEl = screen.getByText(label)
  return labelEl.nextElementSibling?.textContent ?? ""
}

beforeEach(() => {
  wallet.address = "GTESTACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  createSwapOrder.mockClear()
  sendBatchOrderTxn.mockClear()
})

afterEach(cleanup)

describe("ConfirmationDialog (#227)", () => {
  it("renders the order summary from the fixture", async () => {
    renderDialog()

    // Fee estimation effect settles (uses mocked estimateFee).
    await screen.findByText("~0.5 XLM")

    const heading = screen.getByRole("heading")
    // market + side are shown in the title.
    expect(heading.textContent).toContain("BTC") // market
    expect(heading.textContent).toContain("Long") // side

    expect(rowValue("Size")).toBe(formatUsd(SIZE_USD)) // size
    expect(rowValue("Collateral")).toBe("1000 USDC") // collateral
    expect(rowValue("Total fees")).toBe(formatUsd(TOTAL_FEES_USD)) // estimated fees
    expect(rowValue("Entry price")).toBe(formatUsd(ENTRY_PRICE)) // price
  })

  it("runs the order flow and closes when Confirm is clicked", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await screen.findByText("~0.5 XLM")

    await user.click(screen.getByRole("button", { name: /Confirm Long/i }))

    await waitFor(() => expect(sendBatchOrderTxn).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(createSwapOrder).not.toHaveBeenCalled()
  })

  it("closes without submitting when Cancel is clicked", async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await screen.findByText("~0.5 XLM")

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(sendBatchOrderTxn).not.toHaveBeenCalled()
    expect(createSwapOrder).not.toHaveBeenCalled()
  })
})
