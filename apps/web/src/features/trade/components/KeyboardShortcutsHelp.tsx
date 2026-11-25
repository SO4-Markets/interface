"use client"

import { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { getRegisteredShortcuts, registerShortcut, useKeyboardShortcut } from "@/lib/use-keyboard-shortcut"

type KeyboardShortcutsHelpProps = {
  onStartTour?: () => void
}

function formatShortcut(combo: string): string {
  const parts = combo.split("+")
  return parts.map((part) => part.trim()).join(" + ")
}

export function KeyboardShortcutsHelp({ onStartTour }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false)
  const shortcuts = getRegisteredShortcuts()

  useEffect(() => {
    registerShortcut("?", { description: "Open keyboard shortcuts help" })
  }, [])

  useKeyboardShortcut({
    combo: "?",
    description: "Open keyboard shortcuts help",
    onTrigger: () => setOpen(true),
  })

  return (
    <>
      {/* Rendered in flow by the caller. A fixed, floating trigger sat on top
          of whatever control shared its corner at each width (the OHLC table
          toggle, the Positions tab, Reset layout). */}
      <Button
        variant="outline"
        size="sm"
        data-tour-help-trigger
        className="touch-target"
        onClick={() => setOpen(true)}
      >
        Help
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-4">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          Press <Kbd>?</Kbd> to open this help at any time.
        </DialogDescription>
        <ScrollArea tone="overlay" className="mt-3 max-h-[60vh]" viewportClassName="space-y-2">
          {shortcuts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No shortcuts registered yet.</p>
          ) : (
            shortcuts.map((shortcut) => (
              <div key={shortcut.combo} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 break-words">{shortcut.description}</span>
                <KbdGroup className="shrink-0">
                  {formatShortcut(shortcut.combo).split(" + ").map((key, i) => (
                    <Kbd key={i}>{key}</Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))
          )}
        </ScrollArea>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false)
              onStartTour?.()
            }}
          >
            Replay workspace tour
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
