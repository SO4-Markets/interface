import { useEffect, useState } from "react"

export interface FirstLoadSequenceConfig {
  /** Delay before starting the title animation (ms) */
  titleDelay?: number
  /** Delay before showing the CTA and stats (ms) */
  ctaDelay?: number
  /** Delay before revealing feature grid (ms) */
  gridDelay?: number
}

const DEFAULT_CONFIG: Required<FirstLoadSequenceConfig> = {
  titleDelay: 200,
  ctaDelay: 400,
  gridDelay: 800,
}

export function useHeroFirstLoadSequence(config?: FirstLoadSequenceConfig) {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config }
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [showTitle, setShowTitle] = useState(false)
  const [showCta, setShowCta] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  useEffect(() => {
    // No "has run" ref: under StrictMode the effect mounts, cleans up (clearing
    // the timers) and mounts again, and a ref guard would skip the second run,
    // leaving the hero at opacity 0 forever. isFirstLoad already stops re-runs.
    if (!isFirstLoad) return

    const titleTimer = setTimeout(() => setShowTitle(true), resolvedConfig.titleDelay)
    const ctaTimer = setTimeout(() => setShowCta(true), resolvedConfig.ctaDelay)
    const gridTimer = setTimeout(() => setShowGrid(true), resolvedConfig.gridDelay)
    const finishTimer = setTimeout(() => setIsFirstLoad(false), resolvedConfig.gridDelay + 50)

    return () => {
      clearTimeout(titleTimer)
      clearTimeout(ctaTimer)
      clearTimeout(gridTimer)
      clearTimeout(finishTimer)
    }
  }, [isFirstLoad, resolvedConfig.titleDelay, resolvedConfig.ctaDelay, resolvedConfig.gridDelay])

  return {
    showTitle,
    showCta,
    showGrid,
    isSequenceComplete: !isFirstLoad,
  }
}
