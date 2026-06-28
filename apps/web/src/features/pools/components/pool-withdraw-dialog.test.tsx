import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PoolTransactionDialog } from "./pool-transaction-dialog"
import type { PoolMarketConfig } from "../data/markets"

vi.mock("@/lib/contracts", () => ({
  getTokenClient: () => ({
    balance: vi.fn().mockResolvedValue(0n),
  }),
}))

vi.mock("../lib/pool-transactions", () => ({
  submitPoolDeposit: vi.fn(),
  submitPoolWithdrawal: vi.fn().mockResolvedValue({
    hash: "testWithdrawalHash123",
    expectedAmount: 25_000_000n,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn().mockReturnValue("toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/shared/components/NumberInput", () => ({
  NumberInput: ({
    value,
    onValueChange,
    onMax,
    placeholder,
  }: {
    value: string
    onValueChange: (v: string) => void
    onMax?: () => void
    placeholder?: string
  }) => (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
      />
      {onMax && <button onClick={onMax}>MAX</button>}
    </div>
  ),
}))

vi.mock("@/shared/components/TokenIcon", () => ({
  TokenIcon: ({ symbol }: { symbol: string }) => <span data-testid={`icon-${symbol}`} />,
}))

const FAKE_MARKET: PoolMarketConfig = {
  label: "TWBTC/TUSDC",
  displayName: "BTC/USD",
  marketToken: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  indexToken: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSE2",
  longToken: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSE2",
  shortToken: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSDS",
  longSymbol: "TWBTC",
  shortSymbol: "TUSDC",
  decimals: 7,
}

const FAKE_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const USER_GM_BALANCE = 100_000_000n

describe("PoolTransactionDialog — withdraw mode (#329)", () => {
  let queryClient: QueryClient
  let onClose: ReturnType<typeof vi.fn>
  let onQueued: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })
    onClose = vi.fn()
    onQueued = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderDialog(overrides?: Partial<React.ComponentProps<typeof PoolTransactionDialog>>) {
    return render(
      <QueryClientProvider client={queryClient}>
        <PoolTransactionDialog
          open
          mode="withdraw"
          market={FAKE_MARKET}
          account={FAKE_ACCOUNT}
          userGmBalance={USER_GM_BALANCE}
          onClose={onClose}
          onQueued={onQueued}
          {...overrides}
        />
      </QueryClientProvider>,
    )
  }

  it("renders the withdraw dialog title and description", async () => {
    renderDialog()

    expect(screen.getByText("Withdraw TWBTC/TUSDC")).toBeInTheDocument()
    expect(screen.getByText(/Queue a withdrawal/)).toBeInTheDocument()
  })

  it("renders the GM token input field", async () => {
    renderDialog()

    expect(screen.getByText("GM")).toBeInTheDocument()
  })

  it("shows a MAX button for the GM field", async () => {
    renderDialog()

    const maxButton = screen.getByText("MAX")
    expect(maxButton).toBeInTheDocument()
  })

  it("enters a GM amount", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "5.0")

    expect(input).toHaveValue("5.0")
  })

  it("clicks MAX and fills the GM amount with full balance", async () => {
    const user = userEvent.setup()
    renderDialog()

    const maxButton = screen.getByText("MAX")
    await user.click(maxButton)

    const input = screen.getByRole("textbox")
    expect(input.value).not.toBe("")
  })

  it("disables submit when no GM amount is entered", async () => {
    renderDialog()

    const submitButton = screen.getByText("Queue Withdrawal")
    expect(submitButton).toBeDisabled()
  })

  it("enables submit when a valid GM amount is entered", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "5.0")

    const submitButton = screen.getByText("Queue Withdrawal")
    expect(submitButton).not.toBeDisabled()
  })

  it("calls onQueued after successful withdrawal", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "5.0")

    await user.click(screen.getByText("Queue Withdrawal"))

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument()
    })
    expect(onQueued).toHaveBeenCalled()
  })

  it("shows validation error for invalid decimal input", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "1.12345678")

    await waitFor(() => {
      expect(
        screen.getByText("Enter amounts with no more than 7 decimal places."),
      ).toBeInTheDocument()
    })
  })

  it("shows balance validation error when amount exceeds GM balance", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "11.0")

    await waitFor(() => {
      expect(screen.getByText("Insufficient GM balance.")).toBeInTheDocument()
    })
  })

  it("shows queued state after successful withdrawal", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByRole("textbox")
    await user.type(input, "5.0")

    const submitButton = screen.getByText("Queue Withdrawal")
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument()
    })
  })

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup()
    renderDialog()

    const cancelButton = screen.getByText("Cancel")
    await user.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
  })
})
