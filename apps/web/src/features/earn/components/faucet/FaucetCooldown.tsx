import { useEffect, useRef, useState } from "react"

type Props = {
  lastClaimLedger: number | null
  nextClaimLedger: number
  currentLedger: number
  isLoading?: boolean
}

function formatCountdown(remainingLedgers: number): string {
  if (remainingLedgers <= 0) return "Claim available"

  const ledgerSeconds = 5
  const totalSeconds = remainingLedgers * ledgerSeconds
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `Next claim in ${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `Next claim in ${minutes}m ${seconds}s`
  }
  return `Next claim in ${seconds}s`
}

function getProgressPercent(currentLedger: number, nextClaimLedger: number, cooldownLedgers: number): number {
  const elapsed = currentLedger - (nextClaimLedger - cooldownLedgers)
  return Math.min(100, Math.max(0, (elapsed / cooldownLedgers) * 100))
}

export function FaucetCooldown({ lastClaimLedger, nextClaimLedger, currentLedger, isLoading }: Props) {
  const [countdown, setCountdown] = useState("")
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownLedgers = 120 // ~10 minutes

  useEffect(() => {
    function updateCountdown() {
      const remainingLedgers = Math.max(0, nextClaimLedger - currentLedger)
      setCountdown(formatCountdown(remainingLedgers))
      setProgress(getProgressPercent(currentLedger, nextClaimLedger, cooldownLedgers))
    }

    updateCountdown()

    intervalRef.current = setInterval(updateCountdown, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [currentLedger, nextClaimLedger, cooldownLedgers])

  if (isLoading) {
    return <div className="h-32 motion-safe:animate-pulse rounded-lg bg-muted" />
  }

  const isAvailable = currentLedger >= nextClaimLedger
  const canClaim = isAvailable && lastClaimLedger !== null

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Faucet Status</h3>
        <p className={`text-2xl font-bold ${canClaim ? "text-green-500" : "text-muted-foreground"}`}>
          {countdown}
        </p>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-[width,background-color] duration-slowest motion-reduce:transition-none ${isAvailable ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Last claim: Ledger {lastClaimLedger ?? "N/A"}</span>
          <span>Current: Ledger {currentLedger}</span>
        </div>
      </div>

      {lastClaimLedger && (
        <p className="text-xs text-muted-foreground">
          Next claim available at ledger {nextClaimLedger}
        </p>
      )}
    </div>
  )
}
