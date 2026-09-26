import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AmendOrderDialog, type AmendTarget } from "./AmendOrderDialog"

function createTarget(overrides: Partial<AmendTarget> = {}): AmendTarget {
  return {
    orderKey: "order-1",
    marketName: "BTC/USD",
    orderType: "LimitIncrease",
    isLong: true,
    triggerPrice: 100,
    remainingSizeUsd: 1000,
    filledSizeUsd: 200,
    stage: "accepted",
    ...overrides,
  }
}

describe("AmendOrderDialog (OB-084)", () => {
  it("renders only amendable fields with the queue-priority notice", () => {
    render(
      <AmendOrderDialog
        order={createTarget()}
        open
        onClose={() => {}}
        onSubmit={async () => ({ status: "cancel-failed", error: "no" })}
      />,
    )
    expect(screen.getByLabelText(/trigger price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/size/i)).toBeInTheDocument()
    expect(screen.getByText(/loses queue priority/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel and replace/i })).toBeDisabled()
  })

  it("offers no enabled action for market orders", () => {
    render(
      <AmendOrderDialog
        order={createTarget({ orderType: "MarketIncrease" })}
        open
        onClose={() => {}}
        onSubmit={async () => ({ status: "cancel-failed", error: "no" })}
      />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent(/market orders/i)
    expect(screen.getByRole("button", { name: /cancel and replace/i })).toBeDisabled()
    expect(screen.queryByLabelText(/trigger price/i)).toBeNull()
  })

  it("validates against the current remaining size", async () => {
    const user = userEvent.setup()
    render(
      <AmendOrderDialog
        order={createTarget()}
        open
        onClose={() => {}}
        onSubmit={async () => ({ status: "cancel-failed", error: "no" })}
      />,
    )
    await user.type(screen.getByLabelText(/size/i), "5000")
    expect(screen.getByRole("alert")).toHaveTextContent(/remaining/i)
    expect(screen.getByRole("button", { name: /cancel and replace/i })).toBeDisabled()
  })

  it("surfaces a fill during editing and blocks submit", () => {
    const onSubmit = async () => ({ status: "cancel-failed" as const, error: "no" })
    const { rerender } = render(
      <AmendOrderDialog order={createTarget({ filledSizeUsd: 200 })} open onClose={() => {}} onSubmit={onSubmit} />,
    )
    rerender(
      <AmendOrderDialog order={createTarget({ filledSizeUsd: 600 })} open onClose={() => {}} onSubmit={onSubmit} />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent(/filled while editing/i)
    expect(screen.getByRole("button", { name: /cancel and replace/i })).toBeDisabled()
  })

  it("keeps the terminal replace-failed state open instead of implying the order is live", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <AmendOrderDialog
        order={createTarget()}
        open
        onClose={onClose}
        onSubmit={async () => ({
          status: "replace-failed",
          cancelTxHash: "cancel-hash",
          error: "insufficient funds",
          originalGone: true,
        })}
      />,
    )
    await user.type(screen.getByLabelText(/size/i), "500")
    await user.click(screen.getByRole("button", { name: /cancel and replace/i }))
    expect(await screen.findByText(/original order cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/no longer live/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("closes on a successful replacement", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <AmendOrderDialog
        order={createTarget()}
        open
        onClose={onClose}
        onSubmit={async () => ({
          status: "replaced",
          cancelTxHash: "cancel-hash",
          createTxHash: "create-hash",
        })}
      />,
    )
    await user.type(screen.getByLabelText(/size/i), "500")
    await user.click(screen.getByRole("button", { name: /cancel and replace/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
