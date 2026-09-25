import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

let mockData: Array<Record<string, unknown>> = []
let mockIsLoading = false
let mockIsDisabled = false

vi.mock("@/features/trade/hooks/useOrdersWithIndexer", () => ({
  useOrdersWithIndexer: () => ({
    data: mockData,
    isLoading: mockIsLoading,
    isDisabled: mockIsDisabled,
  }),
}))

vi.mock("@/lib/contracts", () => ({
  ExchangeRouterClient: class {},
  SyntheticsReaderClient: class {},
  exchangeRouterClient: {},
  syntheticsReaderClient: {},
  buildCancelOrderTransaction: vi.fn(),
}))

vi.mock("@/features/trade/lib/stellar", () => ({
  cancelOrder: vi.fn(),
  createIncreaseOrder: vi.fn(),
  createDecreaseOrder: vi.fn(),
  createSwapOrder: vi.fn(),
  claimFundingFees: vi.fn(),
  sendBatchOrderTxn: vi.fn(),
  createSidecarOrder: vi.fn(),
  amendOrderViaReplace: vi.fn(),
}))

function createMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    key: "order-1",
    clientOrderId: "order-1",
    account: "GABCDEF123456789",
    marketAddress: "0xbtc",
    marketName: "BTC/USD",
    collateralToken: "USDC",
    orderType: "LimitIncrease",
    status: "active",
    isLong: true,
    sizeUsd: 1000,
    triggerPrice: 50000,
    acceptablePrice: 50250,
    limitOrTrigger: "limit",
    positionKey: null,
    awaitingIndex: false,
    updatedAt: Date.now(),
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let OrdersList: typeof import("./OrdersList").OrdersList

/**
 * OB-090: essential fields/actions remain accessible at mobile widths and
 * with zoom; tables/cards have consistent labels and keyboard reading order.
 */
describe("account workspace responsive (OB-090)", () => {
  beforeEach(async () => {
    OrdersList = (await import("./OrdersList")).OrdersList
    mockData = []
    mockIsLoading = false
    mockIsDisabled = false
    // Narrow viewport + zoom-equivalent small CSS viewport.
    Object.defineProperty(window, "innerWidth", { value: 360, writable: true, configurable: true })
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true, configurable: true })
  })

  it("mirrors every open order as a labelled mobile card with the same actions", () => {
    mockData = [
      createMockOrder({ key: "order-1", clientOrderId: "order-1", marketName: "BTC/USD" }),
      createMockOrder({ key: "order-2", clientOrderId: "order-2", marketName: "ETH/USD", isLong: false }),
    ]
    render(<OrdersList />, { wrapper: createWrapper() })

    const list = screen.getByRole("list", { name: "Open orders" })
    const items = within(list).getAllByRole("listitem")
    expect(items).toHaveLength(2)

    // Consistent labels between table headers and card fields.
    for (const label of ["Type", "Original / remaining", "Trigger", "Created"]) {
      expect(within(list).getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }

    // Essential actions reachable in every card without horizontal scrolling.
    expect(within(list).getAllByRole("button", { name: /amend|edit/i }).length).toBeGreaterThanOrEqual(2)
    expect(within(list).getAllByRole("button", { name: "Cancel" }).length).toBeGreaterThanOrEqual(2)
  })

  it("expands row details with the keyboard in a stable reading order", async () => {
    const user = userEvent.setup()
    mockData = [createMockOrder()]
    render(<OrdersList />, { wrapper: createWrapper() })

    const toggle = screen.getByRole("button", { name: "Details" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    // Keyboard reading order: Details toggle first, then Edit/Cancel inside.
    toggle.focus()
    expect(document.activeElement).toBe(toggle)
    await user.keyboard("{Enter}")
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    const region = document.getElementById(toggle.getAttribute("aria-controls") as string)
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute("role", "region")

    const card = toggle.closest("article") as HTMLElement
    const buttons = within(card).getAllByRole("button")
    const labels = buttons.map((button) => button.textContent)
    expect(labels).toEqual(["Hide details", "Edit", "Cancel"])
  })

  it("keeps the desktop table scroll-contained so zoom never pushes the page sideways", () => {
    mockData = [createMockOrder()]
    const { container } = render(<OrdersList />, { wrapper: createWrapper() })
    const tableContainer = container.querySelector("[data-slot='table-container']")
    expect(tableContainer).not.toBeNull()
    expect(tableContainer?.className).toMatch("overflow-x-auto")
  })

  it("disables (never hides) unsupported amendments on mobile with a reason", () => {
    mockData = [createMockOrder({ orderType: "MarketIncrease", limitOrTrigger: "market" })]
    render(<OrdersList />, { wrapper: createWrapper() })

    const list = screen.getByRole("list", { name: "Open orders" })
    const edit = within(list).getByRole("button", { name: /amend unavailable/i })
    expect(edit).toBeDisabled()
    expect(edit.getAttribute("title")).toMatch(/market orders/i)
    expect(screen.queryByText(/amend order/i)).toBeNull()
  })
})
