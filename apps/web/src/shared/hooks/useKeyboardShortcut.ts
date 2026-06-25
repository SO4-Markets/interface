import { useEffect, useRef } from "react"

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
  const keyRef = useRef(key)
  const onKeyPressRef = useRef(onKeyPress)
  const enabledRef = useRef(enabled)
  keyRef.current = key
  onKeyPressRef.current = onKeyPress
  enabledRef.current = enabled

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return
      if (e.key.toLowerCase() !== keyRef.current.toLowerCase()) return

      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"

      if (isInputFocused) return

      e.preventDefault()
      onKeyPressRef.current()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, []) // stable mount/unmount only
}
