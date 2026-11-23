import * as React from "react"

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null
    const root = document.documentElement
    const sync = () => {
      setReduced(Boolean(media?.matches) || root.dataset.reducedMotion === "true")
    }
    const observer = new MutationObserver(sync)

    sync()
    media?.addEventListener("change", sync)
    observer.observe(root, { attributes: true, attributeFilter: ["data-reduced-motion"] })

    return () => {
      media?.removeEventListener("change", sync)
      observer.disconnect()
    }
  }, [])

  return reduced
}
