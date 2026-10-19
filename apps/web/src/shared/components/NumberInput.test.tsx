import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useState } from "react"
import { NumberInput } from "./NumberInput"

type WrapperProps = {
  defaultValue: string
  usdValue?: number | null
  onMax?: () => void
}

function Wrapper({ defaultValue, usdValue, onMax }: WrapperProps) {
  const [value, setValue] = useState(defaultValue)
  return (
    <NumberInput
      value={value}
      onValueChange={setValue}
      usdValue={usdValue}
      onMax={onMax}
    />
  )
}

describe("NumberInput", () => {
  it("renders current value and USD equivalent", () => {
    render(<NumberInput value="1.23" onValueChange={vi.fn()} usdValue={12.3} />)
    expect(screen.getByRole("textbox")).toHaveValue("1.23")
    expect(screen.getByText("$12.30")).toBeInTheDocument()
  })

  it("calls onValueChange for valid decimal input and ignores invalid characters", async () => {
    render(<Wrapper defaultValue="" />)

    const input = screen.getByRole("textbox")
    await userEvent.type(input, "12.34")

    expect(input).toHaveValue("12.34")
    await userEvent.type(input, "a")
    expect(input).toHaveValue("12.34")
  })

  it("fires the max button when provided", async () => {
    const onMax = vi.fn()
    render(<NumberInput value="" onValueChange={vi.fn()} onMax={onMax} />)
    await userEvent.click(screen.getByRole("button", { name: "MAX" }))
    expect(onMax).toHaveBeenCalled()
  })

  it("disables both the input and the max button when disabled", async () => {
    const onMax = vi.fn()
    render(<NumberInput value="" onValueChange={vi.fn()} onMax={onMax} disabled />)

    expect(screen.getByRole("textbox")).toBeDisabled()
    const maxButton = screen.getByRole("button", { name: "MAX" })
    expect(maxButton).toBeDisabled()

    await userEvent.click(maxButton)
    expect(onMax).not.toHaveBeenCalled()
  })

  it("exposes an invalid state via aria-invalid", () => {
    render(<NumberInput value="" onValueChange={vi.fn()} aria-invalid="true" />)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
  })

  it("does not change on wheel input or scientific-notation keys", () => {
    const onValueChange = vi.fn()
    render(<NumberInput value="1.2" onValueChange={onValueChange} />)
    const input = screen.getByRole("textbox")

    fireEvent.wheel(input)
    fireEvent.keyDown(input, { key: "e" })
    fireEvent.keyDown(input, { key: "+" })
    expect(input).toHaveValue("1.2")
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
