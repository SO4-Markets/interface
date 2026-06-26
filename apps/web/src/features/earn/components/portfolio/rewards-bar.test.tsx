import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { EarnStats } from "../../hooks/use-earn-data"

const earnStatsStub: { data: EarnStats; isLoading: boolean } = {
  data: {
    totalInvestmentUsd: 0,
    totalEarnedUsd: 0,
    totalPendingRewardsUsd: 0,
    stakingPowerSharePct: 0,
  },
  isLoading: false,
}

vi.mock("../../hooks/use-earn-data", () => ({
  useEarnStats: () => earnStatsStub,
}))

vi.mock("../../lib/earn", () => ({
  claimRewards: vi.fn(() => Promise.resolve("TX_HASH")),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("RewardsBar — portfolio rewards (#235)", () => {
  beforeEach(() => {
    earnStatsStub.data = {
      totalInvestmentUsd: 0,
      totalEarnedUsd: 0,
      totalPendingRewardsUsd: 0,
      stakingPowerSharePct: 0,
    }
    earnStatsStub.isLoading = false
  })

  it("renders zero reward values when stats are empty", async () => {
    const { RewardsBar } = await import("./rewards-bar")
    render(<RewardsBar />)

    expect(screen.getByText("Total investment value")).toBeInTheDocument()
    expect(screen.getByText("Total pending rewards")).toBeInTheDocument()
  })

  it("disables Claim rewards button when pending rewards are zero", async () => {
    const { RewardsBar } = await import("./rewards-bar")
    render(<RewardsBar />)

    const claimButton = screen.getByRole("button", { name: /Claim rewards/i })
    expect(claimButton).toBeDisabled()
  })

  it("enables Claim rewards button when pending rewards are non-zero", async () => {
    earnStatsStub.data = {
      totalInvestmentUsd: 500,
      totalEarnedUsd: 100,
      totalPendingRewardsUsd: 42.5,
      stakingPowerSharePct: 12,
    }

    const { RewardsBar } = await import("./rewards-bar")
    render(<RewardsBar />)

    const claimButton = screen.getByRole("button", { name: /Claim rewards/i })
    expect(claimButton).not.toBeDisabled()
  })

  it("shows skeleton loaders while isLoading is true", async () => {
    earnStatsStub.isLoading = true

    const { RewardsBar } = await import("./rewards-bar")
    const { container } = render(<RewardsBar />)

    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders the info banner by default", async () => {
    const { RewardsBar } = await import("./rewards-bar")
    render(<RewardsBar />)

    expect(
      screen.getByText(/Protocol fees are accumulating/i),
    ).toBeInTheDocument()
  })

  it("renders Staking Power Share stat", async () => {
    earnStatsStub.data = {
      totalInvestmentUsd: 0,
      totalEarnedUsd: 0,
      totalPendingRewardsUsd: 0,
      stakingPowerSharePct: 0,
    }

    const { RewardsBar } = await import("./rewards-bar")
    render(<RewardsBar />)

    expect(screen.getByText("Staking Power Share")).toBeInTheDocument()
  })
})
