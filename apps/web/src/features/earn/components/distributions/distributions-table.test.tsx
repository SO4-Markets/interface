import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  DistributionsTable,
  type DistributionRow,
} from "./distributions-table"

afterEach(cleanup)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SINGLE_CLAIM: DistributionRow[] = [
  {
    epoch: "W-12",
    date: "Jun 15, 2026",
    amountUsd: 125.5,
    token: "USDC",
    status: "claim",
  },
]

const MULTI: DistributionRow[] = [
  {
    epoch: "W-11",
    date: "Jun 8, 2026",
    amountUsd: 250.0,
    token: "USDC",
    status: "claimed",
    txHash: "abc123def456ghij",
  },
  {
    epoch: "W-12",
    date: "Jun 15, 2026",
    amountUsd: 75.0,
    token: "esSO4",
    status: "claim",
  },
  {
    epoch: "W-13",
    date: "Jun 22, 2026",
    amountUsd: 0,
    token: "USDC",
    status: "upcoming",
  },
]

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DistributionsTable", () => {
  it("renders the empty state when no distributions are provided", () => {
    render(<DistributionsTable distributions={[]} />)
    expect(screen.getByText("No distributions yet")).toBeInTheDocument()
  })

  it("renders a single distribution row with claim status", () => {
    render(<DistributionsTable distributions={SINGLE_CLAIM} />)

    expect(screen.getByText("W-12")).toBeInTheDocument()
    expect(screen.getByText("Jun 15, 2026")).toBeInTheDocument()
    expect(screen.getByText("USDC")).toBeInTheDocument()
    // "$125.50" rendered by formatUsd
    expect(screen.getByText("$125.50")).toBeInTheDocument()
    // Claim status renders an interactive button
    expect(
      screen.getByRole("button", { name: "Claim" }),
    ).toBeInTheDocument()
  })

  it("renders multiple rows with correct token, date, and status text", () => {
    render(<DistributionsTable distributions={MULTI} />)

    // Epoch column
    expect(screen.getByText("W-11")).toBeInTheDocument()
    expect(screen.getByText("W-12")).toBeInTheDocument()
    expect(screen.getByText("W-13")).toBeInTheDocument()

    // Status badges / buttons
    expect(screen.getByText("Claimed")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Claim" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Upcoming")).toBeInTheDocument()

    // Token column
    expect(screen.getByText("esSO4")).toBeInTheDocument()
  })

  it("fires onClaim with the epoch id when the Claim button is clicked", async () => {
    const onClaim = vi.fn()
    const user = userEvent.setup()

    render(
      <DistributionsTable distributions={SINGLE_CLAIM} onClaim={onClaim} />,
    )

    await user.click(screen.getByRole("button", { name: "Claim" }))
    expect(onClaim).toHaveBeenCalledOnce()
    expect(onClaim).toHaveBeenCalledWith("W-12")
  })

  it("renders a truncated tx hash when provided", () => {
    render(<DistributionsTable distributions={MULTI} />)
    // txHash "abc123def456ghij" → first 8 chars + "…"
    expect(screen.getByText("abc123de…")).toBeInTheDocument()
  })

  it("renders a dash placeholder when no txHash is present", () => {
    render(<DistributionsTable distributions={SINGLE_CLAIM} />)
    // The em-dash placeholder for rows without txHash
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
