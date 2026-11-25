import { cn } from "@workspace/ui/lib/utils"
import { useNetworkHealth } from "../hooks/useNetworkHealth"

export function NetworkHealthIndicator({ className }: { className?: string }) {
  const health = useNetworkHealth()
  const color = health.status === "healthy"
    ? "bg-success"
    : health.status === "disconnected"
      ? "bg-muted-foreground"
      : "bg-warning"
  const label = health.status === "healthy" ? health.displayLabel
    : health.status === "offline" ? "Offline"
      : health.status === "mismatch" ? "Wrong network"
        : health.status === "connecting" ? "Connecting"
          : health.status === "error" ? "Reconnect wallet" : "Wallet disconnected"

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-11 text-muted-foreground", className)}
      title={health.message}
      role="status"
      aria-live="polite"
      aria-label={`Connection and network status: ${health.message}`}
    >
      <span className={cn("size-1.5 rounded-full", color, health.status === "healthy" && "motion-safe:animate-pulse")} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

