/**
 * apps/web/src/features/trade/components/positions/FundingActivityList.test.tsx
 *
 * OB-088: Regression tests ensuring funding and fee activity is displayed
 * with explicit units, correct accrual/settlement status labels, and that
 * claim actions are only available for settled funding-type rows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFeeClaimsData = {
  data: [] as Array<{
    id: string
    key: string
    account: string
    feeType: string
    amount: string
    amountUsd: string | null
    status: string
    ledger: number
    timestamp: Date
    transactionHash: string
    market: { id: string; key: string; name: string } | null
    token: { address: string; symbol: string | null; decimals: number | null } | null
  }>,
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  error: null,
  isDisabled: false,
  fetchNextPage: vi.fn(),
  pageCount: 1,
}

vi.mock("../../hooks/useAccountFeeClaims", () => ({
  useAccountFeeClaims: vi.fn(() => mockFeeClaimsData),
}))

vi.mock("../../lib/stellar", () => ({
  claimFundingFees: vi.fn(),
}))

vi.mock("@/features/wallet/store/wallet-store", () => ({
  useWalletStore: (selector: (s: { address: string | null }) => unknown) =>
    selector({ address: "GABCDEF123456" }),
}))

vi.mock("@/lib/graphql/query-keys", () => ({
  indexerQueryKeys: {
    fees: {
      pagesAll: (a: string) => ["fees", "pages", a],
    },
  },
}))

vi.mock("../../lib/query-keys", () => ({
  activeQueryNetwork: () => "testnet",
  queryKeys: {
    wallet: {
      tokenBalances: (a: string, n: string) => ["wallet", n, "token-balances", a],
    },
  },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function W({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function makeClaim(overrides: Partial<typeof mockFeeClaimsData.data[0]> = {}): typeof mockFeeClaimsData.data[0] {
  return {
    id: "fee-1",
    key: "fee-key-1",
    account: "GABCDEF123456",
    feeType: "funding",
    amount: "10000000", // 1.0 in 7-decimal Stellar format
    amountUsd: "1.23",
    status: "settled",
    ledger: 100,
    timestamp: new Date("2024-01-15T10:00:00Z"),
    transactionHash: "abc123",
    market: { id: "market-1", key: "BTC-USD", name: "BTC/USD" },
    token: { address: "CUSDC...", symbol: "USDC", decimals: 7 },
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

// Dynamically import to respect vi.mock hoisting.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let FundingActivityList: typeof import("./FundingActivityList").FundingActivityList

describe("FundingActivityList (OB-088)", () => {
  beforeEach(async () => {
    const module = await import("./FundingActivityList")
    FundingActivityList = module.FundingActivityList
    mockFeeClaimsData.data = []
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows empty state when there is no fee activity", () => {
    render(React.createElement(FundingActivityList, { feeType: "funding" }), {
      wrapper: buildWrapper(),
    })
    expect(screen.getByText(/No funding activity/i)).toBeInTheDocument()
  })

  it("renders token symbol explicitly next to the amount (OB-088 unit requirement)", () => {
    mockFeeClaimsData.data = [makeClaim()]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    // The token symbol 'USDC' must appear alongside the amount.
    expect(screen.getByText("USDC")).toBeInTheDocument()
  })

  it("shows 'Settled' status badge for a settled fee row", () => {
    mockFeeClaimsData.data = [makeClaim({ status: "settled" })]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText("Settled")).toBeInTheDocument()
  })

  it("shows 'Accruing' status badge for an accrued row", () => {
    mockFeeClaimsData.data = [makeClaim({ status: "accrued" })]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText("Accruing")).toBeInTheDocument()
  })

  it("shows 'Claimed' status badge for an already-claimed row", () => {
    mockFeeClaimsData.data = [makeClaim({ status: "claimed" })]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText("Claimed")).toBeInTheDocument()
  })

  it("shows Claim button only for settled funding rows", () => {
    mockFeeClaimsData.data = [
      makeClaim({ id: "fee-settled", feeType: "funding", status: "settled" }),
      makeClaim({ id: "fee-accrued", feeType: "funding", status: "accrued" }),
      makeClaim({ id: "fee-claimed", feeType: "funding", status: "claimed" }),
    ]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })

    // Only one Claim button should be rendered (for the settled row).
    const claimButtons = screen.queryAllByRole("button", { name: /claim/i })
    expect(claimButtons).toHaveLength(1)
  })

  it("shows Unavailable for non-claimable accruing rows instead of hiding the action", () => {
    mockFeeClaimsData.data = [
      makeClaim({ id: "fee-accrued", feeType: "funding", status: "accrued" }),
    ]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText("Unavailable")).toBeInTheDocument()
  })

  it("does not show Claim for non-funding fee types (position fees are auto-settled)", () => {
    mockFeeClaimsData.data = [
      makeClaim({ id: "fee-position", feeType: "position_fee", status: "settled" }),
    ]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    const claimButton = screen.queryByRole("button", { name: /claim/i })
    expect(claimButton).toBeNull()
  })

  it("displays market name in the row", () => {
    mockFeeClaimsData.data = [makeClaim()]
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText("BTC/USD")).toBeInTheDocument()
  })

  it("shows indexer-disabled message when isDisabled=true", () => {
    mockFeeClaimsData.isDisabled = true
    render(React.createElement(FundingActivityList, {}), { wrapper: buildWrapper() })
    expect(screen.getByText(/indexer is disabled/i)).toBeInTheDocument()
    mockFeeClaimsData.isDisabled = false
  })
})
