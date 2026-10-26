"use client"

import { useEffect, useState } from "react"

import { CommandMenu  } from "@workspace/ui/components/command-menu"
import { Icon } from "@workspace/ui/components/icon"
import { Home01Icon, Search01Icon, Settings01Icon } from "@hugeicons/core-free-icons"
import type {CommandMenuGroup} from "@workspace/ui/components/command-menu";
import { registerShortcut, useKeyboardShortcut } from "@/lib/use-keyboard-shortcut"

type CommandPaletteProps = {
  onFocusMarketSearch: () => void
  onFocusChart: () => void
  onFocusBook: () => void
  onFocusTrade: () => void
  onFocusPositions: () => void
  onToggleTheme: () => void
}

export function CommandPalette({
  onFocusMarketSearch,
  onFocusChart,
  onFocusBook,
  onFocusTrade,
  onFocusPositions,
  onToggleTheme,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  // Register the palette shortcut globally for discoverability, and handle ⌘K to open.
  useEffect(() => {
    registerShortcut("Cmd+K", { description: "Open command palette" })
  }, [])

  useKeyboardShortcut({
    combo: "Cmd+K",
    description: "Open command palette",
    onTrigger: () => setOpen(true),
  })

  const groups: Array<CommandMenuGroup> = [
    {
      id: "navigation",
      label: "Navigation",
      items: [
        {
          id: "search-markets",
          label: "Search markets",
          description: "Find a market by symbol or address",
          icon: <Icon icon={Search01Icon} size="md" />,
          shortcut: ["⌘", "K"],
          onSelect: () => {
            onFocusMarketSearch()
            setOpen(false)
          },
        },
        {
          id: "focus-chart",
          label: "Chart",
          description: "Focus the price chart",
          icon: <Icon icon={Home01Icon} size="md" />,
          shortcut: ["⌘", "1"],
          onSelect: () => {
            onFocusChart()
            setOpen(false)
          },
        },
        {
          id: "focus-book",
          label: "Order book",
          description: "Focus the market depth panel",
          shortcut: ["⌘", "2"],
          onSelect: () => {
            onFocusBook()
            setOpen(false)
          },
        },
        {
          id: "focus-trade",
          label: "Trade panel",
          description: "Focus the order ticket",
          shortcut: ["⌘", "3"],
          onSelect: () => {
            onFocusTrade()
            setOpen(false)
          },
        },
        {
          id: "focus-positions",
          label: "Positions",
          description: "Focus the positions panel",
          shortcut: ["⌘", "4"],
          onSelect: () => {
            onFocusPositions()
            setOpen(false)
          },
        },
      ],
    },
    {
      id: "preferences",
      label: "Preferences",
      items: [
        {
          id: "toggle-theme",
          label: "Toggle theme",
          description: "Switch between light and dark appearance",
          icon: <Icon icon={Settings01Icon} size="md" />,
          shortcut: ["⌘", ","],
          onSelect: () => {
            onToggleTheme()
            setOpen(false)
          },
        },
      ],
    },
  ]

  return (
    <CommandMenu
      open={open}
      onOpenChange={setOpen}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      title="Command palette"
      description="Search for a market or action."
      placeholder="Search commands…"
    />
  )
}
