import {  useEffect, useState } from "react"
import {
  CHART_ROW_HEIGHT_MAX,
  CHART_ROW_HEIGHT_MIN,
  clamp,
} from "../store/layout-preferences-store"
import type {RefObject} from "react";

/** Minimum height left for the panel below the chart row (e.g. account tabs). */
const MIN_BOTTOM_HEIGHT = 160

/**
 * Clamps a stored chart-row height against the *live* size of its
 * container, so restoring a saved layout on a smaller screen never pushes
 * the sibling panel below its usable minimum (OB-038 acceptance criterion).
 */
export function useBoundedChartHeight(
  containerRef: RefObject<HTMLElement | null>,
  requestedHeight: number
): number {
  const [containerHeight, setContainerHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      setContainerHeight(entry.contentRect.height)
    })
    observer.observe(el)
    setContainerHeight(el.getBoundingClientRect().height)

    return () => observer.disconnect()
  }, [containerRef])

  if (containerHeight == null) {
    return clamp(requestedHeight, CHART_ROW_HEIGHT_MIN, CHART_ROW_HEIGHT_MAX)
  }

  const maxForContainer = Math.max(CHART_ROW_HEIGHT_MIN, containerHeight - MIN_BOTTOM_HEIGHT)
  return clamp(requestedHeight, CHART_ROW_HEIGHT_MIN, Math.min(CHART_ROW_HEIGHT_MAX, maxForContainer))
}
