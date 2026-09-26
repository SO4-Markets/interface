import {  useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type {ReactNode} from "react";
import { useViewportReveal } from "@/lib/use-viewport-reveal"
import { useReducedMotion } from "@/lib/use-reduced-motion"

type ViewportRevealProps = {
  children: ReactNode
  className?: string
  /** CSS class to apply when revealed (default: animation-class) */
  revealClass?: string
}

/**
 * Wrapper component that reveals children when they enter the viewport.
 * Automatically respects reduced-motion preferences. Children remain in
 * document flow even before reveal for accessibility.
 */
export function ViewportReveal({
  children,
  className,
  revealClass = "opacity-100",
}: ViewportRevealProps) {
  const reducedMotion = useReducedMotion()
  const [isRevealed, setIsRevealed] = useState(reducedMotion)

  const ref = useViewportReveal({
    once: true,
    threshold: 0.1,
    onReveal: () => setIsRevealed(true),
  })

  // If reduced-motion is enabled, reveal immediately and don't apply animation
  useEffect(() => {
    if (reducedMotion) {
      setIsRevealed(true)
    }
  }, [reducedMotion])

  return (
    <div
      ref={ref}
      className={cn(
        "transition-opacity",
        reducedMotion ? revealClass : isRevealed ? revealClass : "opacity-0",
        // Use duration-base for reveal animations
        !reducedMotion && "duration-base",
        className
      )}
    >
      {children}
    </div>
  )
}
