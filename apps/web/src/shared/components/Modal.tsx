import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"
import { cn } from "@workspace/ui/lib/utils"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[aria-hidden='true']"),
  )
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

type Props = {
  open: boolean
  onClose: () => void
  /** Element that triggered the modal — focus returns here on close */
  triggerRef?: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

export function Modal({
  open,
  onClose,
  triggerRef,
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const savedFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      savedFocus.current = (triggerRef?.current ?? document.activeElement) as HTMLElement
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      firstFocusable?.focus()

      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          onClose()
          return
        }
        if (e.key === "Tab" && dialogRef.current) {
          trapFocus(dialogRef.current, e)
        }
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    } else {
      savedFocus.current?.focus()
    }
  }, [open, onClose, triggerRef])

  if (!open) return null

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        className={cn(
          "relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
