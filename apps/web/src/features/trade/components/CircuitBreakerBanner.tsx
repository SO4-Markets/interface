import { useState } from "react"
import { useCircuitBreaker } from "../hooks/useCircuitBreaker"

type Props = {
  symbol: string | undefined
}

export function CircuitBreakerBanner({ symbol }: Props) {
  const { data: status } = useCircuitBreaker(symbol)
  const [dismissed, setDismissed] = useState(false)

  if (!status?.active || dismissed) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
    >
      <p>{status.message}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-xs font-medium text-amber-300 hover:text-amber-100"
      >
        Dismiss
      </button>
    </div>
  )
}
