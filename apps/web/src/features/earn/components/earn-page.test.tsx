import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/ui/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}))

vi.mock("./portfolio/portfolio-tab", () => ({
  PortfolioTab: () => <div data-testid="portfolio-content">Portfolio content</div>,
}))

vi.mock("./discover/discover-tab", () => ({
  DiscoverTab: () => <div data-testid="discover-content">Discover content</div>,
}))

vi.mock("./additional/additional-opportunities-tab", () => ({
  AdditionalOpportunitiesTab: () => (
    <div data-testid="additional-content">Additional content</div>
  ),
}))

vi.mock("./distributions/distributions-tab", () => ({
  DistributionsTab: () => (
    <div data-testid="distributions-content">Distributions content</div>
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("EarnPage — tab navigation (#234)", () => {
  it("renders the Portfolio tab as selected by default", async () => {
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    expect(screen.getByRole("tab", { name: "Portfolio" })).toBeInTheDocument()
    expect(screen.getByTestId("portfolio-content")).toBeInTheDocument()
  })

  it("renders all four tab triggers", async () => {
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    expect(screen.getByRole("tab", { name: "Portfolio" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Discover" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Additional opportunities" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Distributions" })).toBeInTheDocument()
  })

  it("shows Discover content when Discover tab is clicked", async () => {
    const user = userEvent.setup()
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    await user.click(screen.getByRole("tab", { name: "Discover" }))

    expect(screen.getByTestId("discover-content")).toBeInTheDocument()
  })

  it("shows Additional content when Additional opportunities tab is clicked", async () => {
    const user = userEvent.setup()
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    await user.click(screen.getByRole("tab", { name: "Additional opportunities" }))

    expect(screen.getByTestId("additional-content")).toBeInTheDocument()
  })

  it("shows Distributions content when Distributions tab is clicked", async () => {
    const user = userEvent.setup()
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    await user.click(screen.getByRole("tab", { name: "Distributions" }))

    expect(screen.getByTestId("distributions-content")).toBeInTheDocument()
  })

  it("returns to Portfolio content when Portfolio tab is clicked after switching", async () => {
    const user = userEvent.setup()
    const { EarnPage } = await import("./earn-page")
    render(<EarnPage />)

    await user.click(screen.getByRole("tab", { name: "Discover" }))
    await user.click(screen.getByRole("tab", { name: "Portfolio" }))

    expect(screen.getByTestId("portfolio-content")).toBeInTheDocument()
  })
})
