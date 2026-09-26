import { useEffect, useRef, useState } from "react"

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
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!isFirstLoad || hasRunRef.current) return
    hasRunRef.current = true

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
