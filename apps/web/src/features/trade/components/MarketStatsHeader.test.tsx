import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { MarketStatsHeader } from "./MarketStatsHeader"
import { formatUsd } from "@/shared/lib/format"

const fixture = {
  volume24h: 12_345_678,
  openInterest: 4_200_000,
  markPrice: 67_890.12,
  indexPrice: 67_850.5,
}

describe("MarketStatsHeader", () => {
  it("formats market statistics with the shared USD formatter", () => {
    const view = render(<MarketStatsHeader {...fixture} />)

    expect(
      view.getByText(formatUsd(fixture.volume24h, { compact: true }))
    ).toBeInTheDocument()
    expect(
      view.getByText(formatUsd(fixture.openInterest, { compact: true }))
    ).toBeInTheDocument()
    expect(view.getByText(formatUsd(fixture.markPrice))).toBeInTheDocument()
    expect(view.getByText(formatUsd(fixture.indexPrice))).toBeInTheDocument()
  })

  it("uses the fallback for missing or unavailable values", () => {
    const view = render(
      <MarketStatsHeader volume24h={NaN} markPrice={Infinity} />
    )

    expect(view.getAllByText("—")).toHaveLength(5)
    expect(view.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  })
})
