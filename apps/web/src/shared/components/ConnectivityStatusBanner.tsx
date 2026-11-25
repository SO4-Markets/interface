import { useEffect, useRef, useState } from "react"

type ConnectivityState = "online" | "offline" | "restored"

const RESTORED_NOTICE_MS = 5_000

/** A site-wide, accessible notice for connection loss and recovery. */
export function ConnectivityStatusBanner() {
  const [state, setState] = useState<ConnectivityState>("online")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let wasOffline = !navigator.onLine
    if (wasOffline) setState("offline")

    function handleOffline() {
      wasOffline = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      setState("offline")
    }

    function handleOnline() {
      if (!wasOffline) return
      wasOffline = false
      setState("restored")
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        setState("online")
      }, RESTORED_NOTICE_MS)
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (state === "online") return null

  const message = state === "offline"
    ? "You’re offline. This page stays open, but routes and market data that haven’t loaded may be unavailable. Transactions are not queued."
    : "Connection restored. Market data is refreshing. Check transaction activity before retrying anything interrupted."

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sticky top-0 z-50 border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-sm text-text-primary"
    >
      {message}
    </div>
  )
}