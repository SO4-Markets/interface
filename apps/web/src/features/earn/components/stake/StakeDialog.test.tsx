import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StakeDialog } from "./StakeDialog"

// Mock the mutation hook
const mockMutateAsync = vi.fn().mockResolvedValue("0x123")
vi.mock("../../hooks/useStakeMutation", () => ({
  useStakeMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("StakeDialog", () => {
  it("renders correctly and switches tabs", async () => {
    const user = userEvent.setup()
    render(<StakeDialog isOpen={true} onOpenChange={() => {}} />)

    // Check defaults (stake mode)
    expect(screen.getByRole("heading", { name: "Stake SO4" })).toBeInTheDocument()
    expect(screen.getByText("Duration Multiplier")).toBeInTheDocument()

    // Switch to unstake
    await user.click(screen.getByRole("button", { name: "Unstake" }))
    expect(screen.getByRole("heading", { name: "Unstake SO4" })).toBeInTheDocument()
    expect(screen.queryByText("Duration Multiplier")).not.toBeInTheDocument()
  })

  it("handles input and submit correctly", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<StakeDialog isOpen={true} onOpenChange={onOpenChange} />)

    const input = screen.getByPlaceholderText("0.00")
    await user.type(input, "100")

    const submitBtn = screen.getByRole("button", { name: "Stake SO4", exact: true })
    expect(submitBtn).not.toBeDisabled()

    await user.click(submitBtn)

    // The mutation is mocked so it will resolve and close the dialog
    expect(mockMutateAsync).toHaveBeenCalledWith({
      action: "stake",
      amount: 100,
      durationMultiplier: 1, // Default multiplier
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("changes the duration multiplier when a button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<StakeDialog isOpen={true} onOpenChange={onOpenChange} />)

    const input = screen.getByPlaceholderText("0.00")
    await user.type(input, "50")

    // Click the 2x multiplier
    await user.click(screen.getByRole("button", { name: "2x" }))

    const submitBtn = screen.getByRole("button", { name: "Stake SO4", exact: true })
    await user.click(submitBtn)

    expect(mockMutateAsync).toHaveBeenCalledWith({
      action: "stake",
      amount: 50,
      durationMultiplier: 2,
    })
  })
})
