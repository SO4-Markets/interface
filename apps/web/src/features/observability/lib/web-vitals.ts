import { telemetry } from "./telemetry"

/** Capture native browser performance entries without wallet identifiers. */
export function installWebVitalsReporting(): () => void {
  if (typeof PerformanceObserver === "undefined") return () => {}
  const observers: Array<PerformanceObserver> = []
  const watch = (type: string, handle: (entry: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) handle(entry)
      })
      observer.observe({ type, buffered: true })
      observers.push(observer)
    } catch {
      // Browser does not implement this entry type.
    }
  }
  let shift = 0
  watch("largest-contentful-paint", (entry) => telemetry.recordWebVital("LCP", entry.startTime))
  watch("layout-shift", (entry) => {
    const shiftEntry = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
    if (shiftEntry.hadRecentInput) return
    shift += shiftEntry.value ?? 0
    telemetry.recordWebVital("CLS", shift, shift <= 0.1 ? "good" : shift <= 0.25 ? "needs-improvement" : "poor")
  })
  watch("event", (entry) => {
    const interaction = entry as PerformanceEntry & { interactionId?: number; duration?: number }
    if (interaction.interactionId) {
      const duration = interaction.duration
      telemetry.recordWebVital("INP", duration, duration <= 200 ? "good" : duration <= 500 ? "needs-improvement" : "poor")
    }
  })
  return () => observers.forEach((observer) => observer.disconnect())
}