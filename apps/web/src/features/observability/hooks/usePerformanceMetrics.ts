import { useEffect, useState } from "react"
import { telemetry } from "../lib/telemetry"
import type { TelemetrySummary } from "../lib/telemetry"

export function usePerformanceMetrics(pollIntervalMs = 5000) {
  const [summary, setSummary] = useState<TelemetrySummary>(() => telemetry.getSummary())

  useEffect(() => {
    const update = () => {
      setSummary(telemetry.getSummary())
    }

    const interval = setInterval(update, pollIntervalMs)
    return () => clearInterval(interval)
  }, [pollIntervalMs])

  return summary
}
