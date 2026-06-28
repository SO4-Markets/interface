import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { cn } from "@workspace/ui/lib/utils"

export type ToastVariant = "success" | "error" | "info"

export type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
  /** Auto-dismiss after this many ms. 0 = no auto-dismiss. */
  duration: number
}

type ToastContextValue = {
  toasts: ToastItem[]
  show: (message: string, variant?: ToastVariant, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _counter = 0
function nextId() {
  return `toast-${++_counter}`
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-green-900/90 text-green-100 border-green-700/50",
  error: "bg-red-900/90 text-red-100 border-red-700/50",
  info: "bg-slate-800/90 text-slate-100 border-slate-700/50",
}

const VARIANT_LABEL: Record<ToastVariant, string> = {
  success: "Success",
  error: "Error",
  info: "Info",
}

const DEFAULT_DURATION = 4000

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (item.duration <= 0) return
    timerRef.current = setTimeout(() => onDismiss(item.id), item.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [item.id, item.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${VARIANT_LABEL[item.variant]}: ${item.message}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        VARIANT_CLASSES[item.variant],
      )}
    >
      <span>{item.message}</span>
      <button
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", duration = DEFAULT_DURATION) => {
      const item: ToastItem = { id: nextId(), message, variant, duration }
      setToasts((prev) => [...prev, item])
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}
