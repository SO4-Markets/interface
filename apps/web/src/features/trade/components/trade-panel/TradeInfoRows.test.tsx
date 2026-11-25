import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TradeFees } from "../../hooks/useTradeFees"

let mockFees: TradeFees = {
  positionFeeUsd: 1,
  priceImpactUsd: 0.05,
  priceImpactPct: 0.005,
  executionFeeUsd: 0.051,
  executionFeeXlm: 0.3,
  totalFeesUsd: 1.101,
  feeBps: 10,
  borrowingRatePerHour: 0.0001,
  isLoading: false,
  status: "estimated",
  feesBreakdown: [],
}

let mockFundingQuery = {
  data: { ratePerHour: 0.0001, nextEpochTs: Date.now() + 3600_000 } as
    | { ratePerHour: number; nextEpochTs: number }
    | undefined,
  isLoading: false,
  isError: false,
}

vi.mock("../../hooks/useTradeFees", () => ({
  useTradeFees: () => mockFees,
}))

vi.mock("../../hooks/useFundingRate", () => ({
  useFundingRate: () => mockFundingQuery,
}))

vi.mock("../../hooks/useTokenPrices", () => ({
  useTokenPrices: () => ({
    getMidPrice: () => 50_000,
  }),
}))

const { TradeInfoRows } = await import("./TradeInfoRows")

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe("TradeInfoRows fee breakdown integration (#1083)", () => {
  beforeEach(() => {
    mockFees = {
      positionFeeUsd: 1,
      priceImpactUsd: 0.05,
      priceImpactPct: 0.005,
      executionFeeUsd: 0.051,
      executionFeeXlm: 0.3,
      totalFeesUsd: 1.101,
      feeBps: 10,
      borrowingRatePerHour: 0.0001,
      isLoading: false,
      status: "estimated",
      feesBreakdown: [],
    }
    mockFundingQuery = {
      data: { ratePerHour: 0.0001, nextEpochTs: Date.now() + 3600_000 },
      isLoading: false,
      isError: false,
    }
  })

  afterEach(cleanup)

  it("renders accessible fee breakdown alongside trade estimates with exact precision", async () => {
    const user = userEvent.setup()
    render(
      <TradeInfoRows
        tradeType="Long"
        tradeMode="Market"
        toTokenAddress="BTC"
        marketAddress="0xbtc"
        leverage={10}
        fromAmount="100"
        sizeUsd={1_000}
        riskParams={{ maxLeverage: 50, maintenanceMarginRateBps: 50, updatedAt: Date.now() }}
      />,
      { wrapper },
    )

    expect(screen.getAllByText("$1.101").length).toBeGreaterThanOrEqual(2)
    const toggle = screen.getByRole("button", { name: /fee & cost breakdown/i })
    await user.click(toggle)

    const region = screen.getByRole("region", { name: "Trade fee breakdown" })
    expect(region).toHaveTextContent("~0.30 XLM ($0.051)")
    expect(region).toHaveTextContent("Funding & fees docs")
  })

  it("surfaces loading and unavailable states for fees and funding", async () => {
    const user = userEvent.setup()
    mockFees = {
      positionFeeUsd: null,
      priceImpactUsd: null,
      priceImpactPct: null,
      executionFeeUsd: null,
      executionFeeXlm: null,
      totalFeesUsd: null,
      isLoading: true,
      status: "unknown",
      feesBreakdown: [],
    }
    mockFundingQuery = { data: undefined, isLoading: true, isError: false }

    const { rerender } = render(
      <TradeInfoRows
        tradeType="Long"
        tradeMode="Market"
        toTokenAddress="BTC"
        marketAddress="0xbtc"
        leverage={10}
        fromAmount="100"
        sizeUsd={1_000}
        riskParams={null}
      />,
      { wrapper },
    )

    await user.click(screen.getByRole("button", { name: /fee & cost breakdown/i }))
    expect(screen.getByRole("status", { name: "Loading trade fee breakdown" })).toBeInTheDocument()

    mockFees = { ...mockFees, isLoading: false, status: "unknown" }
    mockFundingQuery = { data: undefined, isLoading: false, isError: true }

    rerender(
      <TradeInfoRows
        tradeType="Long"
        tradeMode="Market"
        toTokenAddress="BTC"
        marketAddress="0xbtc"
        leverage={10}
        fromAmount="100"
        sizeUsd={1_000}
        riskParams={null}
      />,
    )

    expect(screen.getByText(/verified fee schedule or executable depth is currently unavailable/i)).toBeInTheDocument()
  })
})
