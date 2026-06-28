import { describe, it, expect, afterEach, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/contracts", () => ({}))

import { CreateReferralDialog } from "./CreateReferralDialog"

const mockMutateAsync = vi.fn().mockResolvedValue("0x123")
vi.mock("../hooks/useCreateReferralCodeMutation", () => ({
  useCreateReferralCodeMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("CreateReferralDialog", () => {
  it("renders correctly", () => {
    render(<CreateReferralDialog isOpen={true} onOpenChange={() => {}} />)
    expect(screen.getByRole("heading", { name: "Create Referral Code" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create Code" })).toBeDisabled()
  })

  it("validates input formatting", async () => {
    const user = userEvent.setup()
    render(<CreateReferralDialog isOpen={true} onOpenChange={() => {}} />)

    const input = screen.getByPlaceholderText("e.g. MY_CUSTOM_CODE")
    
    // Too short
    await user.type(input, "AB")
    expect(screen.getByText("Minimum 3 characters")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create Code" })).toBeDisabled()
    
    await user.clear(input)

    // Invalid chars
    await user.type(input, "CODE-123")
    expect(screen.getByText("Only letters, numbers, and underscores allowed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create Code" })).toBeDisabled()

    await user.clear(input)

    // Valid
    await user.type(input, "VALID_CODE123")
    expect(screen.queryByText("Minimum 3 characters")).not.toBeInTheDocument()
    expect(screen.queryByText("Only letters, numbers, and underscores allowed")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create Code" })).not.toBeDisabled()
  })

  it("submits the valid code and closes", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateReferralDialog isOpen={true} onOpenChange={onOpenChange} />)

    const input = screen.getByPlaceholderText("e.g. MY_CUSTOM_CODE")
    await user.type(input, "MY_CODE")
    
    const submitBtn = screen.getByRole("button", { name: "Create Code" })
    await user.click(submitBtn)

    expect(mockMutateAsync).toHaveBeenCalledWith("MY_CODE")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
