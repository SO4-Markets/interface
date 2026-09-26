/**
 * OB-058: Source health status badge component.
 *
 * Displays connection state with appropriate visual indicators
 * for: initial load, empty venue, connected, stale, reconnecting,
 * rate limited, revision gap, and error states.
 */

import { cn } from "@workspace/ui/lib/utils"
import type { SourceHealth } from "../../hooks/useSourceHealth"
import { formatStaleDuration } from "../../hooks/useSourceHealth"

type Props = {
  health: SourceHealth
  className?: string
}

export function SourceHealthBadge({ health, className }: Props) {
  const { status, staleDuration, message } = health

  // Determine badge appearance based on status
  const badgeConfig = getBadgeConfig(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px]", // ds-allow: consistent with existing status badges
        badgeConfig.textColor,
        className
      )}
      title={message}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          badgeConfig.dotColor,
          badgeConfig.animate && "animate-pulse"
        )}
        aria-hidden="true"
      />
      <span>{badgeConfig.label}</span>
      {staleDuration !== null && staleDuration > 5000 && (
        <span className="text-muted-foreground">
          ({formatStaleDuration(staleDuration)})
        </span>
      )}
    </span>
  )
}

type BadgeConfig = {
  label: string
  textColor: string
  dotColor: string
  animate: boolean
}

function getBadgeConfig(status: SourceHealth["status"]): BadgeConfig {
  switch (status) {
    case "initial-load":
      return {
        label: "Connecting…",
        textColor: "text-amber-500",
        dotColor: "bg-amber-500",
        animate: true,
      }
    case "empty-venue":
      return {
        label: "No Depth",
        textColor: "text-muted-foreground",
        dotColor: "bg-muted-foreground",
        animate: false,
      }
    case "connected":
      return {
        label: "Live",
        textColor: "text-green-500",
        dotColor: "bg-green-500",
        animate: true,
      }
    case "stale":
      return {
        label: "Stale",
        textColor: "text-amber-600",
        dotColor: "bg-amber-600",
        animate: false,
      }
    case "reconnecting":
      return {
        label: "Reconnecting…",
        textColor: "text-amber-500",
        dotColor: "bg-amber-500",
        animate: true,
      }
    case "rate-limited":
      return {
        label: "Rate Limited",
        textColor: "text-orange-500",
        dotColor: "bg-orange-500",
        animate: false,
      }
    case "revision-gap":
      return {
        label: "Resyncing…",
        textColor: "text-amber-500",
        dotColor: "bg-amber-500",
        animate: true,
      }
    case "error":
      return {
        label: "Error",
        textColor: "text-destructive",
        dotColor: "bg-destructive",
        animate: false,
      }
  }
}
