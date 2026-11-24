import { useEffect, useRef } from "react"
import { LiveRegion, useAnnouncer } from "@workspace/ui/components/live-region"
import { evaluateLiquidationWarnings } from "../lib/trade-announcements"
import type { LiquidationWatchPosition } from "../lib/trade-announcements"

type Props = {
  positions: ReadonlyArray<LiquidationWatchPosition>
}

/**
 * Speaks a warning when an open position moves within the liquidation danger
 * band (issue 956). Assertive, because ignoring it can cost the trader their
 * collateral — the case the LiveRegion guidance reserves `assertive` for.
 *
 * The region is mounted empty and stays mounted, so the first warning is a
 * content change the screen reader observes.
 */
export function LiquidationWarningAnnouncer({ positions }: Props) {
  const { message, announcementKey, announce } = useAnnouncer()
  const warned = useRef<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const result = evaluateLiquidationWarnings(positions, warned.current)
    warned.current = result.warned
    if (result.messages.length > 0) announce(result.messages.join(" "))
  }, [positions, announce])

  return (
    <LiveRegion
      mode="assertive"
      message={message}
      announcementKey={announcementKey}
      data-testid="liquidation-announcer"
    />
  )
}
