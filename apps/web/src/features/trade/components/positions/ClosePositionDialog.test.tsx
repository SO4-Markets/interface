import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClosePositionDialog } from "./ClosePositionDialog"
import type { Position } from "../../hooks/usePositions"

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

function createMockPosition(overrides: Partial<Position> = {}): Position {
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
    markPrice: 51_000,
    liquidationPrice: 45_000,
    leverage: 10,
    pnl: 1_000,
    pnlPercent: 20,
    isLong: true,
    pnlAfterFees: 950,
    fundingFeeUsd: 50,
    ...overrides,
  }
}

describe("ClosePositionDialog", () => {
  describe("rendering", () => {
    it("renders nothing when position is null", () => {
      const { container } = render(
        <ClosePositionDialog position={null} open={true} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(container.firstChild).toBeNull()
    })

    it("shows the market name in the dialog title", () => {
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      expect(screen.getByRole("heading", { name: /Close Position.*BTC\/USD/ })).toBeInTheDocument()
    })

    it("shows position size in the info block", () => {
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      expect(screen.getByText("$50,000.00")).toBeInTheDocument()
    })

    it("shows Long badge for a long position", () => {
      render(
        <ClosePositionDialog
          position={createMockPosition({ isLong: true })}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      expect(screen.getByText("Long")).toBeInTheDocument()
    })

    it("shows Short badge for a short position", () => {
      render(
        <ClosePositionDialog
          position={createMockPosition({ isLong: false })}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      expect(screen.getByText("Short")).toBeInTheDocument()
    })

    it("defaults to full close mode", () => {
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      expect(screen.getByText(/Closes the entire position/)).toBeInTheDocument()
    })
  })

  describe("close type toggling", () => {
    it("shows partial amount input after toggling to partial close", async () => {
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument()
    })

    it("hides partial amount input when switching back to full close", async () => {
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.click(screen.getByRole("button", { name: /Full close/i }))
      expect(screen.queryByPlaceholderText("0.00")).not.toBeInTheDocument()
    })
  })

  describe("confirm callback payload", () => {
    it("supports percentage presets for partial close", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )
      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.click(screen.getByRole("button", { name: "Close 25% of position" }))
      expect(screen.getByDisplayValue("12500.00")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledWith({ isFull: false, sizeDeltaUsd: 12_500 })
    })

    it("calls onConfirm with full payload on full close", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )
      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledWith({ isFull: true, sizeDeltaUsd: 50_000 })
    })

    it("calls onConfirm with partial payload when a partial amount is entered", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )
      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.type(screen.getByPlaceholderText("0.00"), "10000")
      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledWith({ isFull: false, sizeDeltaUsd: 10_000 })
    })

    it("calls onClose after confirm to dismiss the dialog", async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      )
      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe("validation messages", () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      await user.click(screen.getByRole("button", { name: /Partial close/i }))
    })

    it("disables confirm button when partial amount is empty", () => {
      expect(screen.getByRole("button", { name: "Confirm Close" })).toBeDisabled()
    })

    it("shows an error when partial amount equals position size", async () => {
      const user = userEvent.setup()
      await user.type(screen.getByPlaceholderText("0.00"), "50000")
      expect(screen.getByText(/less than total position size/i)).toBeInTheDocument()
    })

    it("shows an error when partial amount exceeds position size", async () => {
      const user = userEvent.setup()
      await user.type(screen.getByPlaceholderText("0.00"), "99999")
      expect(screen.getByText(/less than total position size/i)).toBeInTheDocument()
    })

    it("enables confirm button for a valid partial amount", async () => {
      const user = userEvent.setup()
      await user.type(screen.getByPlaceholderText("0.00"), "10000")
      expect(screen.getByRole("button", { name: "Confirm Close" })).toBeEnabled()
    })
  })

  describe("cancel button", () => {
    it("calls onClose when cancel is clicked", async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      )
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("live PnL preview, presets, keyboard, and transaction states (#1081)", () => {
    it("shows live PnL preview for full close and updates proportionally for partial presets", async () => {
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition({
            sizeUsd: 50_000,
            collateralUsd: 5_000,
            pnlAfterFees: 1_000,
            pnlPercent: 20,
          })}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )

      const preview = screen.getByLabelText("Close preview")
      expect(preview).toHaveTextContent("$1,000.00")
      expect(preview).toHaveTextContent("+20.00%")
      expect(preview).toHaveTextContent("$0.00")

      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.click(screen.getByRole("button", { name: "Close 50% of position" }))

      expect(screen.getByDisplayValue("25000.00")).toBeInTheDocument()
      expect(preview).toHaveTextContent("$500.00")
      expect(preview).toHaveTextContent("$25,000.00")
      expect(preview).toHaveTextContent("$2,500.00")

      await user.click(screen.getByRole("button", { name: "Close 75% of position" }))
      expect(screen.getByDisplayValue("37500.00")).toBeInTheDocument()
      expect(preview).toHaveTextContent("$750.00")
      expect(preview).toHaveTextContent("$12,500.00")
    })

    it("preserves sub-cent precision for non-even position sizes", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition({ sizeUsd: 100.333333 })}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )

      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.click(screen.getByRole("button", { name: "Close 25% of position" }))
      expect(screen.getByDisplayValue("25.083333")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledWith({ isFull: false, sizeDeltaUsd: 25.083333 })
    })

    it("switches back to full close when 100% preset is selected", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )

      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.click(screen.getByRole("button", { name: "Close 100% of position" }))
      expect(screen.getByText(/Closes the entire position/)).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledWith({ isFull: true, sizeDeltaUsd: 50_000 })
    })

    it("supports keyboard arrow navigation between presets and Enter submit", async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )

      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      const preset25 = screen.getByRole("button", { name: "Close 25% of position" })
      preset25.focus()
      await user.keyboard("{ArrowRight}")
      expect(screen.getByRole("button", { name: "Close 50% of position" })).toHaveFocus()
      await user.keyboard("{Enter}")
      expect(screen.getByDisplayValue("25000.00")).toBeInTheDocument()

      const input = screen.getByLabelText("Size to close (USD)")
      input.focus()
      await user.keyboard("{Enter}")
      expect(onConfirm).toHaveBeenCalledWith({ isFull: false, sizeDeltaUsd: 25_000 })
    })

    it("resets draft state when reopened for another position", async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <ClosePositionDialog
          position={createMockPosition({ key: "pos-1" })}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )

      await user.click(screen.getByRole("button", { name: /Partial close/i }))
      await user.type(screen.getByPlaceholderText("0.00"), "1000")

      rerender(
        <ClosePositionDialog
          position={createMockPosition({ key: "pos-2", marketName: "ETH/USD" })}
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )

      expect(screen.getByText(/Closes the entire position/)).toBeInTheDocument()
      expect(screen.queryByPlaceholderText("0.00")).not.toBeInTheDocument()
    })

    it("disables duplicate submission while async close is pending and surfaces errors", async () => {
      const user = userEvent.setup()
      let rejectFn!: (err: Error) => void
      const onConfirm = vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFn = reject
          }),
      )
      const onClose = vi.fn()

      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      )

      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("button", { name: /Submitting/i })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
      expect(onClose).not.toHaveBeenCalled()

      rejectFn(new Error("Transaction rejected in your wallet. No changes were made."))

      expect(await screen.findByRole("alert")).toHaveTextContent(/rejected in your wallet/i)
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Confirm Close" })).toBeEnabled()
    })

    it("keeps the dialog open when the close action returns no transaction hash", async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(
        <ClosePositionDialog
          position={createMockPosition()}
          open={true}
          onClose={onClose}
          onConfirm={vi.fn().mockResolvedValue(null)}
        />,
      )

      await user.click(screen.getByRole("button", { name: "Confirm Close" }))
      expect(await screen.findByRole("alert")).toHaveTextContent(/not submitted/i)
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Confirm Close" })).toBeEnabled()
    })
  })
})
