import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import type { MobileTradeView } from "./MobileTradeNav"

const TOUR_COMPLETE_KEY = "so4-trade-workspace-tour-v1-complete"

const STEPS: Array<{
  target: string
  view: MobileTradeView
  title: string
  description: string
}> = [
  {
    target: "market-selector",
    view: "chart",
    title: "Choose a market",
    description: "Select a market here to load its chart, price and order book.",
  },
  {
    target: "order-form",
    view: "trade",
    title: "Build your order",
    description: "Choose a direction, set size and review risk before you submit.",
  },
  {
    target: "positions",
    view: "positions",
    title: "Manage positions",
    description: "Track open positions and switch to orders or trade history here.",
  },
]

type Spotlight = { x: number; y: number; width: number; height: number }

type Props = {
  replayKey: number
  onViewChange: (view: MobileTradeView) => void
}

function readTourComplete(): boolean {
  try {
    return localStorage.getItem(TOUR_COMPLETE_KEY) === "true"
  } catch {
    return false
  }
}

function writeTourComplete(): void {
  try {
    localStorage.setItem(TOUR_COMPLETE_KEY, "true")
  } catch {
    // The tour remains dismissible when storage is unavailable.
  }
}

export function TradeWorkspaceTour({ replayKey, onViewChange }: Props) {
  const reducedMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const cardRef = useRef<HTMLElement>(null)
  const step = stepIndex === null ? null : STEPS[stepIndex]

  useEffect(() => {
    if (readTourComplete()) return
    const timer = window.setTimeout(() => setStepIndex(0), reducedMotion ? 0 : 350)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  useEffect(() => {
    if (replayKey > 0) setStepIndex(0)
  }, [replayKey])

  useEffect(() => {
    if (!step) return
    onViewChange(step.view)
    cardRef.current?.focus()
  }, [onViewChange, step])

  useEffect(() => {
    if (!step) {
      setSpotlight(null)
      return
    }

    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      const target = document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`)
      if (!target) {
        setSpotlight(null)
        return
      }

      const rect = target.getBoundingClientRect()
      const padding = 8
      const x = Math.max(4, rect.left - padding)
      const y = Math.max(4, rect.top - padding)
      setSpotlight({
        x,
        y,
        width: Math.min(rect.width + padding * 2, window.innerWidth - x - 4),
        height: Math.min(rect.height + padding * 2, window.innerHeight - y - 4),
      })
    }

    setSpotlight(null)
    const timer = window.setTimeout(measure, reducedMotion ? 0 : 80)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [reducedMotion, step])

  function dismiss() {
    setStepIndex(null)
    writeTourComplete()
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-tour-help-trigger]")?.focus()
    }, 0)
  }

  useEffect(() => {
    if (!step) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        dismiss()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [step])

  if (!step || stepIndex === null) return null

  const next = () => {
    if (stepIndex === STEPS.length - 1) {
      dismiss()
      return
    }
    setStepIndex(stepIndex + 1)
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" data-testid="trade-workspace-tour">
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="trade-tour-spotlight-mask" maskUnits="userSpaceOnUse">
            <rect width={viewport.width} height={viewport.height} fill="white" />
            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.width}
                height={spotlight.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width={viewport.width}
          height={viewport.height}
          fill="var(--surface-canvas)"
          fillOpacity="0.74"
          mask="url(#trade-tour-spotlight-mask)"
          className="transition-opacity duration-base motion-reduce:transition-none"
        />
        {spotlight && (
          <rect
            data-testid="trade-tour-spotlight"
            x={spotlight.x}
            y={spotlight.y}
            width={spotlight.width}
            height={spotlight.height}
            rx="8"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            style={{
              transition: reducedMotion
                ? "none"
                : "x var(--duration-moderate) var(--ease-out), y var(--duration-moderate) var(--ease-out), width var(--duration-moderate) var(--ease-out), height var(--duration-moderate) var(--ease-out)",
            }}
          />
        )}
      </svg>

      <section
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-tour-title"
        aria-describedby="trade-tour-description"
        aria-live="polite"
        tabIndex={-1}
        className="pointer-events-auto fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] mx-auto flex w-auto max-w-md flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 text-text-primary shadow-xl outline-none transition-opacity duration-base motion-reduce:transition-none md:inset-x-auto md:end-6 md:bottom-6 md:mx-0"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-text-secondary">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Skip tour
          </Button>
        </div>
        <div>
          <h2 id="trade-tour-title" className="text-sm font-semibold">
            {step.title}
          </h2>
          <p id="trade-tour-description" className="mt-1 text-xs text-text-secondary">
            {step.description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            {STEPS.map((item, index) => (
              <span
                key={item.target}
                aria-hidden="true"
                className={`size-1.5 rounded-full ${index === stepIndex ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStepIndex(stepIndex - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {stepIndex === STEPS.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}