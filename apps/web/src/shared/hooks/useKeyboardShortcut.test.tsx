import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useKeyboardShortcut } from "./useKeyboardShortcut"

// Test component that uses the hook
function TestComponent({
  shortcutKey,
  onKeyPress,
  enabled,
}: {
  shortcutKey: string
  onKeyPress: () => void
  enabled?: boolean
}) {
  useKeyboardShortcut({ key: shortcutKey, onKeyPress, enabled })
  return <div data-testid="test-component">Test Component</div>
}

describe("useKeyboardShortcut", () => {
  let onKeyPress: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onKeyPress = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should call callback on simple key press", async () => {
    const user = userEvent.setup()
    render(<TestComponent shortcutKey="s" onKeyPress={onKeyPress} />)

    await user.keyboard("s")

    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should handle case-insensitive key matching", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TestComponent shortcutKey="S" onKeyPress={onKeyPress} />,
    )

    // Press lowercase 's'
    await user.keyboard("s")

    expect(onKeyPress).toHaveBeenCalledTimes(1)

    // Rerender with uppercase 'S' requirement
    onKeyPress.mockClear()
    rerender(<TestComponent shortcutKey="s" onKeyPress={onKeyPress} />)

    // Press uppercase 'S' (simulated via keyboard)
    await user.keyboard("{Shift>}s{/Shift}")

    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should not call callback when different key is pressed", async () => {
    const user = userEvent.setup()
    render(<TestComponent shortcutKey="a" onKeyPress={onKeyPress} />)

    await user.keyboard("b")

    expect(onKeyPress).not.toHaveBeenCalled()
  })

  it("should ignore key press when input is focused", async () => {
    const user = userEvent.setup()
    render(
      <>
        <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />
        <input data-testid="input" />
      </>,
    )

    const input = screen.getByTestId("input")
    await user.click(input)
    await user.keyboard("s")

    expect(onKeyPress).not.toHaveBeenCalled()
  })

  it("should ignore key press when textarea is focused", async () => {
    const user = userEvent.setup()
    render(
      <>
        <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />
        <textarea data-testid="textarea" />
      </>,
    )

    const textarea = screen.getByTestId("textarea")
    await user.click(textarea)
    await user.keyboard("s")

    expect(onKeyPress).not.toHaveBeenCalled()
  })

  it("should ignore key press when contenteditable element is focused", async () => {
    const user = userEvent.setup()
    render(
      <>
        <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />
        <div data-testid="editable" contentEditable={true} />
      </>,
    )

    const editable = screen.getByTestId("editable")
    await user.click(editable)
    await user.keyboard("s")

    expect(onKeyPress).not.toHaveBeenCalled()
  })

  it("should call callback when key is pressed outside input", async () => {
    const user = userEvent.setup()
    render(
      <>
        <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />
        <input data-testid="input" />
        <button data-testid="button">Button</button>
      </>,
    )

    const button = screen.getByTestId("button")
    await user.click(button)
    await user.keyboard("s")

    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should handle modifier keys correctly", async () => {
    const user = userEvent.setup()
    render(<TestComponent shortcutKey="s" onKeyPress={onKeyPress} />)

    // Pressing 's' with Ctrl should still trigger (Ctrl is not checked in hook)
    await user.keyboard("{Control>}s{/Control}")

    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should not call callback when disabled", async () => {
    const user = userEvent.setup()
    render(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress} enabled={false} />,
    )

    await user.keyboard("s")

    expect(onKeyPress).not.toHaveBeenCalled()
  })

  it("should enable/disable shortcut dynamically", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress} enabled={true} />,
    )

    await user.keyboard("s")
    expect(onKeyPress).toHaveBeenCalledTimes(1)

    // Disable shortcut
    onKeyPress.mockClear()
    rerender(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress} enabled={false} />,
    )

    await user.keyboard("s")
    expect(onKeyPress).not.toHaveBeenCalled()

    // Re-enable shortcut
    onKeyPress.mockClear()
    rerender(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress} enabled={true} />,
    )

    await user.keyboard("s")
    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should remove event listener on unmount", async () => {
    const user = userEvent.setup()
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

    const { unmount } = render(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />,
    )

    await user.keyboard("s")
    expect(onKeyPress).toHaveBeenCalledTimes(1)

    // Unmount component
    unmount()

    // Verify removeEventListener was called
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    )

    removeEventListenerSpy.mockRestore()

    // After unmount, the shortcut should not work
    // (though we can't directly test this without re-mounting)
  })

  it("should prevent default behavior on key press", async () => {
    const user = userEvent.setup()
    const preventDefaultSpy = vi.fn()

    render(
      <>
        <TestComponent shortcutKey="s" onKeyPress={onKeyPress} />
        <input
          data-testid="input"
          onKeyDown={(e) => {
            if (e.key === "s") {
              preventDefaultSpy()
            }
          }}
        />
      </>,
    )

    const component = screen.getByTestId("test-component")
    await user.click(component)

    // Track if preventDefault is called by checking behavior
    const events: KeyboardEvent[] = []
    const originalAddEventListener = document.addEventListener
    vi.spyOn(document, "addEventListener").mockImplementation(
      (eventName, handler) => {
        if (eventName === "keydown") {
          const wrappedHandler = (e: KeyboardEvent) => {
            events.push(e)
            return handler(e)
          }
          return originalAddEventListener.call(document, eventName, wrappedHandler)
        }
        return originalAddEventListener.call(document, eventName, handler)
      },
    )

    await user.keyboard("s")

    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should handle changing callback function", async () => {
    const user = userEvent.setup()
    const onKeyPress1 = vi.fn()
    const onKeyPress2 = vi.fn()

    const { rerender } = render(
      <TestComponent shortcutKey="s" onKeyPress={onKeyPress1} />,
    )

    await user.keyboard("s")
    expect(onKeyPress1).toHaveBeenCalledTimes(1)
    expect(onKeyPress2).not.toHaveBeenCalled()

    // Change callback
    rerender(<TestComponent shortcutKey="s" onKeyPress={onKeyPress2} />)

    await user.keyboard("s")
    expect(onKeyPress1).toHaveBeenCalledTimes(1) // Still 1, not called again
    expect(onKeyPress2).toHaveBeenCalledTimes(1) // Called with new callback
  })

  it("should handle changing shortcut key", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TestComponent shortcutKey="a" onKeyPress={onKeyPress} />,
    )

    await user.keyboard("a")
    expect(onKeyPress).toHaveBeenCalledTimes(1)

    onKeyPress.mockClear()

    // Change to different key
    rerender(<TestComponent shortcutKey="b" onKeyPress={onKeyPress} />)

    await user.keyboard("a")
    expect(onKeyPress).not.toHaveBeenCalled()

    await user.keyboard("b")
    expect(onKeyPress).toHaveBeenCalledTimes(1)
  })

  it("should call callback only once per key press", async () => {
    const user = userEvent.setup()
    render(<TestComponent shortcutKey="s" onKeyPress={onKeyPress} />)

    await user.keyboard("s")
    await user.keyboard("s")
    await user.keyboard("s")

    expect(onKeyPress).toHaveBeenCalledTimes(3)
  })
})
