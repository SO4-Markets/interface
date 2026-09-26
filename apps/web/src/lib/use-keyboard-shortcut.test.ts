import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import {
  clearShortcutRegistry,
  getRegisteredShortcuts,
  registerShortcut,
  useKeyboardShortcut,
} from "./use-keyboard-shortcut"

describe("useKeyboardShortcut", () => {
  beforeEach(() => {
    clearShortcutRegistry()
  })

  describe("shortcut matching", () => {
    it("triggers callback on Ctrl+K", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
    })

    it("triggers callback on Cmd+K (Mac equivalent)", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Cmd+K",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
    })

    it("handles Shift modifier", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+Shift+D",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "D",
        ctrlKey: true,
        shiftKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
    })

    it("handles Alt modifier", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Alt+M",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "m",
        altKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
    })

    it("is case-insensitive for keys", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "K",
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
    })

    it("does not trigger if modifiers don't match", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "k",
        altKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).not.toHaveBeenCalled()
    })
  })

  describe("editable mode handling", () => {
    it("ignores shortcuts in input elements by default", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
        })
      )

      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      input.dispatchEvent(event)

      expect(onTrigger).not.toHaveBeenCalled()
      document.body.removeChild(input)
    })

    it("triggers in input if allowInEditableMode is true", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
          allowInEditableMode: true,
        })
      )

      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      input.dispatchEvent(event)

      expect(onTrigger).toHaveBeenCalledOnce()
      document.body.removeChild(input)
    })
  })

  describe("preventDefault", () => {
    it("prevents default behavior when preventDefault is true", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
          preventDefault: true,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      const preventDefaultSpy = vi.spyOn(event, "preventDefault")
      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it("does not prevent default when preventDefault is false", () => {
      const onTrigger = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
          preventDefault: false,
        })
      )

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      const preventDefaultSpy = vi.spyOn(event, "preventDefault")
      window.dispatchEvent(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe("cleanup", () => {
    it("removes listener on unmount", () => {
      const onTrigger = vi.fn()
      const { unmount } = renderHook(() =>
        useKeyboardShortcut({
          combo: "Ctrl+K",
          description: "Test",
          onTrigger,
        })
      )

      unmount()

      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(onTrigger).not.toHaveBeenCalled()
    })
  })
})

describe("Shortcut Registry", () => {
  beforeEach(() => {
    clearShortcutRegistry()
  })

  it("registers and retrieves shortcuts", () => {
    registerShortcut("Ctrl+K", {
      description: "Open command palette",
    })
    registerShortcut("Ctrl+/", {
      description: "Open help",
    })

    const shortcuts = getRegisteredShortcuts()
    expect(shortcuts).toHaveLength(2)
    expect(shortcuts[0]?.description).toBe("Open command palette")
    expect(shortcuts[1]?.description).toBe("Open help")
  })

  it("clears all registered shortcuts", () => {
    registerShortcut("Ctrl+K", { description: "Test" })
    clearShortcutRegistry()

    const shortcuts = getRegisteredShortcuts()
    expect(shortcuts).toHaveLength(0)
  })
})
