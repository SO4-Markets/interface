import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import {
  PositionLiquidationRiskSummary,
  PositionRiskMeter,
} from "./PositionRiskMeter"
import type { Position } from "../../hooks/usePositions"

afterEach(cleanup)

function createPosition(overrides: Partial<Position> = {}): Position {
  return {
    key: "pos-1",
    account: "GABCDEF123456789",
    marketAddress: "0xbtc",
    marketName: "BTC/USD",
    indexToken: "WBTC",
    collateralToken: "USDC",
    collateralAmount: 1,
    collateralUsd: 5_000,
    sizeUsd: 50_000,
    sizeInUsdRaw: 50_000_000_000n,
    entryPrice: 50_000,
    markPrice: 55_000,
    liquidationPrice: 40_000,
    leverage: 10,
    pnl: 5_000,
    pnlPercent: 100,
    isLong: true,
    pnlAfterFees: 4_950,
    fundingFeeUsd: 50,
    ...overrides,
  }
}

describe("PositionLiquidationRiskSummary", () => {
  it("renders loading state accessibly", async () => {
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[]}
        isLoading={true}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(
      screen.getByRole("status", { name: "Loading position liquidation risk" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Loading liquidation risk…")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders disconnected state with text equivalent and meter", async () => {
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[]}
        isLoading={false}
        isDisconnected={true}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("Disconnected")).toBeInTheDocument()
    expect(
      screen.getByText(/connect your wallet to monitor position health/i),
    ).toBeInTheDocument()
    const meter = screen.getByRole("meter", {
      name: "Position liquidation risk (wallet disconnected)",
    })
    expect(meter).toHaveAttribute("aria-valuenow", "0")
    expect(meter).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/wallet disconnected/i),
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders empty state when connected with no open positions", async () => {
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("No positions")).toBeInTheDocument()
    expect(
      screen.getByText(/no open positions — no active liquidation exposure/i),
    ).toBeInTheDocument()
    const meter = screen.getByRole("meter", {
      name: "Position liquidation risk (no open positions)",
    })
    expect(meter).toHaveAttribute("aria-valuenow", "0")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders safe state with semantic meter and text equivalent", async () => {
    // mark=55_000, liq=40_000 => 27.27% distance (> 15% => safe)
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[createPosition()]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("Safe")).toBeInTheDocument()
    expect(screen.getByText(/27\.3% to liq\./)).toBeInTheDocument()
    const meter = screen.getByRole("meter", {
      name: "Liquidation risk for BTC/USD Long",
    })
    expect(meter).toHaveAttribute("aria-valuetext", expect.stringMatching(/Safe — 27\.3% from liquidation/))
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders warning state when position is within 15% of liquidation", async () => {
    // mark=50_000, liq=45_000 => 10% distance (<= 15% => warning)
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[createPosition({ markPrice: 50_000, liquidationPrice: 45_000 })]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("Warning")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      /elevated liquidation risk: btc\/usd long is 10\.0% from liquidation/i,
    )
    const meter = screen.getByRole("meter", {
      name: "Liquidation risk for BTC/USD Long",
    })
    expect(meter).toHaveAttribute("aria-valuenow", "80")
    expect(meter.className).toContain("warning")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders critical danger state when position is within 5% of liquidation", async () => {
    // mark=47_000, liq=45_000 => 4.255% distance (<= 5% => danger)
    const { container } = render(
      <PositionLiquidationRiskSummary
        positions={[createPosition({ markPrice: 47_000, liquidationPrice: 45_000 })]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("Critical")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      /critical liquidation risk: btc\/usd long is within 4\.3% of liquidation/i,
    )
    const meter = screen.getByRole("meter", {
      name: "Liquidation risk for BTC/USD Long",
    })
    expect(meter.className).toContain("danger")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("highlights the highest-risk position across multiple positions", () => {
    const safePos = createPosition({
      key: "pos-safe",
      marketName: "ETH/USD",
      markPrice: 3_000,
      liquidationPrice: 2_000,
    })
    const riskyPos = createPosition({
      key: "pos-risky",
      marketName: "BTC/USD",
      isLong: false,
      markPrice: 50_000,
      liquidationPrice: 52_000, // 4% distance
    })

    render(
      <PositionLiquidationRiskSummary
        positions={[safePos, riskyPos]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "fresh"}
      />,
    )

    expect(screen.getByText("BTC/USD Short")).toBeInTheDocument()
    expect(screen.getByText("Critical")).toBeInTheDocument()
  })

  it("surfaces stale oracle warning without hiding the estimate", () => {
    render(
      <PositionLiquidationRiskSummary
        positions={[createPosition({ markPrice: 50_000, liquidationPrice: 45_000 })]}
        isLoading={false}
        isDisconnected={false}
        getStaleness={() => "stale"}
      />,
    )

    expect(screen.getByText("Stale oracle")).toBeInTheDocument()
    expect(
      screen.getByText(/oracle price is stale; displayed liquidation distance is an outdated estimate/i),
    ).toBeInTheDocument()
  })
})

describe("PositionRiskMeter (row cell)", () => {
  it("renders unavailable state when risk inputs are missing", async () => {
    const { container } = render(
      <PositionRiskMeter
        marketName="BTC/USD"
        isLong={true}
        reading={{
          source: "unavailable",
          isEstimate: false,
          hasData: false,
          isStale: false,
          liquidationDistancePct: 0,
          availableRiskUsd: 0,
        }}
      />,
    )

    expect(screen.getByText("No data")).toBeInTheDocument()
    const meter = screen.getByRole("meter", {
      name: "Liquidation risk for BTC/USD long",
    })
    expect(meter).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/liquidation risk unavailable/i),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
