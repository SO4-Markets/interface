import { useEffect, useState } from "react"
import { ORDER_EXECUTION_FROZEN_MESSAGE } from "@/lib/contracts"

const SESSION_KEY = "so4-order-execution-frozen-dismissed"

type Props = {
  visible: boolean
}

export function OrderExecutionFrozenBanner({ visible }: Props) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(SESSION_KEY) === "1")
    } catch {
      // Safari private mode can throw when accessing sessionStorage
    }
  }, [])

  if (!visible || dismissed) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1")
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      <span>{ORDER_EXECUTION_FROZEN_MESSAGE}</span>
      <button
        type="button"
        onClick={dismiss}
        className="ms-4 shrink-0 font-medium underline-offset-2 hover:underline"
        aria-label="Dismiss order execution paused notice"
      >
        Dismiss
      </button>
    </div>
  )
}
