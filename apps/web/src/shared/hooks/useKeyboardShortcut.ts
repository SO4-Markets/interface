import { useEffect } from "react"

type KeyboardShortcutOptions = {
  key: string
  onKeyPress: () => void
  enabled?: boolean
}

export function useKeyboardShortcut({
  key,
  onKeyPress,
  enabled = true,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== key.toLowerCase()) return

      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"

      if (isInputFocused) return

      e.preventDefault()
      onKeyPress()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [key, onKeyPress, enabled])
}
