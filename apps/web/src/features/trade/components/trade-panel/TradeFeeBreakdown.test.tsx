import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { TradeFeeBreakdown } from "./TradeFeeBreakdown"
import type { TradeFees } from "../../hooks/useTradeFees"

afterEach(cleanup)

const ESTIMATED_FEES: TradeFees = {
  positionFeeUsd: 10,
  priceImpactUsd: 0.051,
  priceImpactPct: 0.0051,
  executionFeeUsd: 0.051,
  executionFeeXlm: 0.3125,
  totalFeesUsd: 10.102,
  feeBps: 10,
  borrowingRatePerHour: 0.0001,
  isLoading: false,
  status: "estimated",
  feesBreakdown: [
    { label: "Position fee", valueUsd: 10 },
    { label: "Price impact", valueUsd: 0.051 },
    { label: "Execution fee", valueUsd: 0.051 },
  ],
}

describe("TradeFeeBreakdown (#1083)", () => {
  it("toggles an accessible region with keyboard/click and exposes doc links", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <TradeFeeBreakdown
        tradeType="Long"
        sizeUsd={1_000}
        fees={ESTIMATED_FEES}
        priceImpactPct={0.0051}
        fundingRate={{ ratePerHour: 0.00003, nextEpochTs: Date.now() + 3_600_000 }}
      />,
    )

    const toggle = screen.getByRole("button", { name: /fee & cost breakdown/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveClass("touch-target")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    const region = screen.getByRole("region", { name: "Trade fee breakdown" })
    expect(region).toHaveTextContent("Position fee (0.10%)")
    expect(region).toHaveTextContent("$10.00")
    expect(region).toHaveTextContent("+0.0051% ($0.051)")
    expect(region).toHaveTextContent("~0.3125 XLM ($0.051)")
    expect(region).toHaveTextContent("$10.102")
    expect(region).toHaveTextContent("8h est.: $0.24")
    expect(region).toHaveTextContent("+0.01%/h")

    const docsLink = screen.getByRole("link", { name: "Funding & fees docs" })
    expect(docsLink).toHaveAttribute("href", "https://docs.so4.market/concepts/funding-and-fees")
    expect(docsLink).toHaveAttribute("target", "_blank")
    expect(docsLink).toHaveAttribute("rel", "noopener noreferrer")

    const liqLink = screen.getByRole("link", { name: "Liquidation & margin" })
    expect(liqLink).toHaveAttribute("href", "https://docs.so4.market/concepts/liquidation")

    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders loading states for both fee config and funding rate", async () => {
    const { container } = render(
      <TradeFeeBreakdown
        tradeType="Long"
        sizeUsd={1_000}
        fees={{
          positionFeeUsd: null,
          priceImpactUsd: null,
          executionFeeUsd: null,
          executionFeeXlm: null,
          totalFeesUsd: null,
          isLoading: true,
          status: "unknown",
          feesBreakdown: [],
        }}
        priceImpactPct={null}
        fundingLoading={true}
        defaultExpanded
      />,
    )

    expect(screen.getByRole("status", { name: "Loading trade fee breakdown" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading funding rate" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders empty amount state clearly", () => {
    render(
      <TradeFeeBreakdown
        tradeType="Long"
        sizeUsd={0}
        fees={{
          positionFeeUsd: null,
          priceImpactUsd: null,
          executionFeeUsd: null,
          executionFeeXlm: null,
          totalFeesUsd: null,
          isLoading: false,
          status: "unknown",
          feesBreakdown: [],
        }}
        priceImpactPct={null}
        fundingUnavailable
        defaultExpanded
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(/enter a trade amount/i)
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(4)
  })

  it("renders stale, insufficient depth, and unavailable XLM USD price states", () => {
    const { rerender } = render(
      <TradeFeeBreakdown
        tradeType="Long"
        sizeUsd={10_000}
        fees={{
          ...ESTIMATED_FEES,
          priceImpactUsd: null,
          priceImpactPct: null,
          executionFeeUsd: null,
          totalFeesUsd: null,
          status: "insufficient",
        }}
        priceImpactPct={null}
        fundingUnavailable
        defaultExpanded
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(/insufficient order-book depth/i)
    expect(screen.getByText("Insufficient depth")).toBeInTheDocument()
    expect(screen.getByText("~0.3125 XLM (USD unavailable)")).toBeInTheDocument()

    rerender(
      <TradeFeeBreakdown
        tradeType="Long"
        sizeUsd={10_000}
        fees={{
          positionFeeUsd: null,
          priceImpactUsd: null,
          executionFeeUsd: null,
          executionFeeXlm: null,
          totalFeesUsd: null,
          isLoading: false,
          status: "stale",
          feesBreakdown: [],
        }}
        priceImpactPct={null}
        fundingUnavailable
        defaultExpanded
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(/stale/i)
    expect(screen.getByText("Stale depth")).toBeInTheDocument()
  })

  it("hides funding and borrow rows for Swap trades", () => {
    render(
      <TradeFeeBreakdown
        tradeType="Swap"
        sizeUsd={1_000}
        fees={{ ...ESTIMATED_FEES, feeBps: 10 }}
        priceImpactPct={0.0051}
        defaultExpanded
      />,
    )

    expect(screen.getByText("Swap fee (0.10%)")).toBeInTheDocument()
    expect(screen.queryByText(/Funding \(rate/)).not.toBeInTheDocument()
    expect(screen.queryByText("Borrow rate")).not.toBeInTheDocument()
  })
})
