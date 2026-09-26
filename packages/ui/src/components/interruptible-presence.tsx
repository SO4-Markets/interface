import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

export type InterruptiblePresenceProps = React.HTMLAttributes<HTMLDivElement> & {
  present: boolean
  children: React.ReactNode
  duration?: number
}

/** Keeps an exiting panel mounted long enough to reverse without a flash. */
export function InterruptiblePresence({ present, children, duration = 160, className, style, ...props }: InterruptiblePresenceProps) {
  const [mounted, setMounted] = React.useState(present)
  const [visible, setVisible] = React.useState(present)

  React.useEffect(() => {
    if (present) {
      setMounted(true)
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), duration)
    return () => window.clearTimeout(timer)
  }, [present, duration])

  if (!mounted) return null

  return (
    <div
      {...props}
      data-state={visible ? "open" : "closed"}
      aria-hidden={!visible || undefined}
      inert={!visible ? true : undefined}
      className={cn("transition-[opacity,transform] duration-150 motion-reduce:transition-none", visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-1", className)}
      style={{ ...style, transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}
