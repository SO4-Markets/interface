import { useEffect, useLayoutEffect, useRef } from "react"
import type { RefObject } from "react"

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

type FocusTrapOptions = {
  active: boolean
  containerRef: RefObject<HTMLElement | null>
  initialFocus?: () => HTMLElement | null
  returnFocus?: () => HTMLElement | null
  include?: () => Array<HTMLElement | null>
  onEscape?: () => void
}

function isTabbable(element: HTMLElement): boolean {
  return element.isConnected && !element.closest("[inert]")
}

function tabbableElements(
  container: HTMLElement,
  extra: Array<HTMLElement | null>
): Array<HTMLElement> {
  const inside = Array.from(
    container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  )
  const outside = extra.filter(
    (element): element is HTMLElement =>
      element !== null && !container.contains(element)
  )
  return [...outside, ...inside]
    .filter(isTabbable)
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
}

export function useFocusTrap(options: FocusTrapOptions) {
  const optionsRef = useRef(options)

  useLayoutEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    if (!options.active) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const ownedElements = () => {
      const { containerRef, include } = optionsRef.current
      const container = containerRef.current
      if (!container) return null
      return { container, extra: include?.() ?? [] }
    }

    const owns = (node: Node | null) => {
      const owned = ownedElements()
      if (!owned || !node) return false
      return (
        owned.container.contains(node) ||
        owned.extra.some((element) => element?.contains(node))
      )
    }

    const owned = ownedElements()
    if (owned) {
      const target =
        optionsRef.current.initialFocus?.() ??
        tabbableElements(owned.container, owned.extra).find((element) =>
          owned.container.contains(element)
        ) ??
        owned.container
      target.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const { onEscape } = optionsRef.current
        if (onEscape) {
          event.preventDefault()
          onEscape()
        }
        return
      }

      if (event.key !== "Tab") return
      const current = ownedElements()
      if (!current) return

      const tabbables = tabbableElements(current.container, current.extra)
      if (tabbables.length === 0) {
        event.preventDefault()
        current.container.focus()
        return
      }

      const first = tabbables[0]
      const last = tabbables[tabbables.length - 1]
      const focused = document.activeElement

      if (!owns(focused)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && (focused === first || focused === current.container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      const focused = document.activeElement
      const focusWasLost =
        focused === null || focused === document.body || owns(focused)
      if (!focusWasLost) return
      const target = optionsRef.current.returnFocus?.() ?? previouslyFocused
      if (target?.isConnected) target.focus()
    }
  }, [options.active])
}
