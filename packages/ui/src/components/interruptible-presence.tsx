import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import { useReducedMotion } from "../hooks/use-reduced-motion"

export type InterruptiblePresenceProps = React.HTMLAttributes<HTMLDivElement> & {
  present: boolean
  children: React.ReactNode
  duration?: number
}

/** Keeps an exiting panel mounted long enough to reverse without a flash. */
export function InterruptiblePresence({ present, children, duration, className, style, ...props }: InterruptiblePresenceProps) {
  const [mounted, setMounted] = React.useState(present)
  const [visible, setVisible] = React.useState(present)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (present) {
      setMounted(true)
      setVisible(true)
      return
    }
    setVisible(false)
    if (reducedMotion) {
      setMounted(false)
      return
    }
    const tokenDuration = Number.parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue("--duration-base"),
    )
    const exitDuration = duration ?? (Number.isFinite(tokenDuration) ? tokenDuration : 150)
    const timer = window.setTimeout(() => setMounted(false), exitDuration)
    return () => window.clearTimeout(timer)
  }, [present, duration, reducedMotion])

  if (!mounted) return null

  return (
    <div
      {...props}
      data-state={visible ? "open" : "closed"}
      aria-hidden={!visible || undefined}
      inert={!visible ? true : undefined}
      className={cn("transition-[opacity,transform] duration-base motion-reduce:transition-none", visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-1", className)}
      style={{ ...style, ...(duration === undefined ? {} : { transitionDuration: `${duration}ms` }) }}
    >
      {children}
    </div>
  )
}
