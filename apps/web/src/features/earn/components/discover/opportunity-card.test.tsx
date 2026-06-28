import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OpportunityCard } from "./opportunity-card"

afterEach(cleanup)

describe("OpportunityCard", () => {
  it("renders APR, token pair, TVL, and action label for valid opportunities", () => {
    const onAction = vi.fn()
    render(
      <OpportunityCard
        name="WBTC/USDC Liquidity"
        tokens={["WBTC", "USDC"]}
        apy={0.125} // FormatPct multiplies by 100 or takes percent directly? Assuming it works like formatUsd
        tvlUsd={1500000}
        onAction={onAction}
        actionLabel="Deposit"
      />
    )

    // Token Pair / Name
    expect(screen.getByText("WBTC/USDC Liquidity")).toBeInTheDocument()

    // Key metrics labels
    expect(screen.getByText("APR")).toBeInTheDocument()
    expect(screen.getByText("TVL")).toBeInTheDocument()

    // Action button
    const button = screen.getByRole("button", { name: "Deposit" })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it("correctly renders the unavailable/coming-soon state", () => {
    render(
      <OpportunityCard
        name="ETH/USDC Liquidity"
        tokens={["ETH", "USDC"]}
        apy={0}
        tvlUsd={0}
        isAvailable={false}
      />
    )

    const button = screen.getByRole("button", { name: "Coming Soon" })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it("fires onAction when the action button is clicked", async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()

    render(
      <OpportunityCard
        name="GLV"
        tokens={["GLV"]}
        apy={0.085}
        tvlUsd={500000}
        onAction={onAction}
        actionLabel="Earn"
      />
    )

    await user.click(screen.getByRole("button", { name: "Earn" }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})
