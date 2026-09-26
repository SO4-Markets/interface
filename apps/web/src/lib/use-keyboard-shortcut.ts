import { useEffect } from "react"

export type KeyboardShortcutConfig = {
  /** Keyboard combo: "Ctrl+K", "Cmd+/", "Alt+M", etc. */
  combo: string
  /** Human-readable description */
  description: string
  /** Callback when shortcut is pressed */
  onTrigger: () => void
  /** Whether to trigger inside contentEditable elements (default: false) */
  allowInEditableMode?: boolean
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean
}

/**
 * Parse keyboard combo string into individual key checks.
 * Supports: Ctrl, Cmd, Shift, Alt + letter/number/special
 * Examples: "Ctrl+K", "Cmd+Shift+D", "Alt+M"
 */
function parseCombo(combo: string): {
  ctrl: boolean
  cmd: boolean
  shift: boolean
  alt: boolean
  key: string
} {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase())
  const parsed = {
    ctrl: parts.includes("ctrl"),
    cmd: parts.includes("cmd") || parts.includes("meta"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts[parts.length - 1],
  }

  return parsed
}

/**
 * Check if a keyboard event matches the given combo.
 * Works with both Ctrl (Windows) and Cmd (Mac) modifiers.
 */
function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo)
  const eventKey = event.key.toLowerCase()

  // Check modifiers
  if (parsed.ctrl && !event.ctrlKey) return false
  if (parsed.cmd && !event.metaKey) return false
  if (parsed.shift && !event.shiftKey) return false
  if (parsed.alt && !event.altKey) return false

  // Check main key
  return eventKey === parsed.key || eventKey === parsed.key.toUpperCase()
}

/**
 * Hook for registering keyboard shortcuts.
 * Automatically cleans up on unmount.
 * Respects contentEditable elements by default.
 */
export function useKeyboardShortcut(config: KeyboardShortcutConfig) {
  const {
    combo,
    onTrigger,
    allowInEditableMode = false,
    preventDefault = true,
  } = config

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Skip if inside an editable element (unless explicitly allowed)
      if (!allowInEditableMode) {
        const target = event.target as HTMLElement
        if (
          target.contentEditable === "true" ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA"
        ) {
          return
        }
      }

      if (matchesCombo(event, combo)) {
        if (preventDefault) event.preventDefault()
        onTrigger()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [combo, onTrigger, allowInEditableMode, preventDefault])
}

/**
 * Global registry of all keyboard shortcuts for discoverability.
 * Apps can use this to build help menus or onboarding.
 */
const shortcutRegistry = new Map<string, Omit<KeyboardShortcutConfig, "onTrigger">>()

export function registerShortcut(
  combo: string,
  config: Omit<KeyboardShortcutConfig, "onTrigger" | "combo">
) {
  shortcutRegistry.set(combo, { combo, ...config })
}

export function getRegisteredShortcuts() {
  return Array.from(shortcutRegistry.values())
}

export function clearShortcutRegistry() {
  shortcutRegistry.clear()
}
