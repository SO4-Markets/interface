import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { SizePresets } from "./SizePresets"

it("applies each percentage and restores a keyboard-edited preset", async () => {
  const user = userEvent.setup()
  const fill = vi.fn()
  const view = render(<SizePresets onFill={fill} />)
  for (const name of ["25%", "50%", "75%", "Max"]) await user.click(screen.getByRole("button", { name }))
  expect(fill.mock.calls.flat()).toEqual([25, 50, 75, 100])
  await user.click(screen.getByRole("button", { name: "Edit presets" }))
  const input = screen.getByRole("spinbutton", { name: "Preset 1 (%)" })
  await user.clear(input)
  expect(screen.getByRole("button", { name: "Save presets" })).toBeDisabled()
  await user.type(input, "15")
  await user.click(screen.getByRole("button", { name: "Save presets" }))
  view.unmount()
  render(<SizePresets onFill={fill} />)
  screen.getByRole("button", { name: "15%" }).focus()
  await user.keyboard("{Enter}")
  expect(fill).toHaveBeenLastCalledWith(15)
})
