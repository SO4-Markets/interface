import { useEffect } from "react"
import { registerShortcut, useKeyboardShortcut } from "@/lib/use-keyboard-shortcut"

export type WorkspaceShortcutsConfig = {
  /** Callback to focus market search (Ctrl+M or Cmd+M) */
  onFocusMarketSearch?: () => void
  /** Callback to focus chart (Ctrl+1 or Cmd+1) */
  onFocusChart?: () => void
  /** Callback to focus book (Ctrl+2 or Cmd+2) */
  onFocusBook?: () => void
  /** Callback to focus trade panel (Ctrl+3 or Cmd+3) */
  onFocusTrade?: () => void
  /** Callback to focus positions (Ctrl+4 or Cmd+4) */
  onFocusPositions?: () => void
}

/**
 * Hook that sets up workspace navigation shortcuts for the trading interface.
 * Shortcuts are registered globally for discoverability in help menus.
 *
 * Shortcuts:
 * - Ctrl/Cmd+M: Focus market search
 * - Ctrl/Cmd+1: Focus chart
 * - Ctrl/Cmd+2: Focus market depth
 * - Ctrl/Cmd+3: Focus trade panel
 * - Ctrl/Cmd+4: Focus positions panel
 */
export function useWorkspaceShortcuts(config: WorkspaceShortcutsConfig) {
  // Register shortcuts globally on mount
  useEffect(() => {
    if (config.onFocusMarketSearch) {
      registerShortcut("Ctrl+M", {
        description: "Focus market search",
      })
    }
    if (config.onFocusChart) {
      registerShortcut("Ctrl+1", {
        description: "Focus chart panel",
      })
    }
    if (config.onFocusBook) {
      registerShortcut("Ctrl+2", {
        description: "Focus market depth panel",
      })
    }
    if (config.onFocusTrade) {
      registerShortcut("Ctrl+3", {
        description: "Focus order ticket",
      })
    }
    if (config.onFocusPositions) {
      registerShortcut("Ctrl+4", {
        description: "Focus positions panel",
      })
    }
  }, [
    config.onFocusMarketSearch,
    config.onFocusChart,
    config.onFocusBook,
    config.onFocusTrade,
    config.onFocusPositions,
  ])

  // Market search shortcut
  useKeyboardShortcut({
    combo: "Ctrl+M",
    description: "Focus market search",
    onTrigger: config.onFocusMarketSearch || (() => {}),
  })

  // Chart focus shortcut
  useKeyboardShortcut({
    combo: "Ctrl+1",
    description: "Focus chart panel",
    onTrigger: config.onFocusChart || (() => {}),
  })

  // Book focus shortcut
  useKeyboardShortcut({
    combo: "Ctrl+2",
    description: "Focus market depth panel",
    onTrigger: config.onFocusBook || (() => {}),
  })

  // Trade panel focus shortcut
  useKeyboardShortcut({
    combo: "Ctrl+3",
    description: "Focus order ticket",
    onTrigger: config.onFocusTrade || (() => {}),
  })

  // Positions panel focus shortcut
  useKeyboardShortcut({
    combo: "Ctrl+4",
    description: "Focus positions panel",
    onTrigger: config.onFocusPositions || (() => {}),
  })
}
