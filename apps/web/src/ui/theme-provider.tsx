import { createContext, useContext, useEffect, useRef, useState } from "react"
import type {ReactNode} from "react";

export type Theme = "dark" | "light" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "dark" | "light"
  highContrast: boolean
  setHighContrast: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = "so4-theme"
const HIGH_CONTRAST_KEY = "so4-high-contrast"

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolve(theme: Theme): "dark" | "light" {
  return theme === "system" ? getSystemTheme() : theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
  })

  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(HIGH_CONTRAST_KEY) === "true"
  })

  const activeTransition = useRef<ViewTransition | null>(null)

  const setTheme = (next: Theme) => {
    if (typeof window === "undefined") {
      setThemeState(next)
      return
    }
    const apply = () => {
      localStorage.setItem(STORAGE_KEY, next)
      const resolved = resolve(next)
      const root = document.documentElement
      root.classList.remove("dark", "light")
      root.classList.add(resolved)
      setThemeState(next)
    }

    // Honour system accessibility preferences and avoid animating when the
    // effective appearance does not change.
    if (
      resolve(next) === resolve(theme) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reducedMotion === "true" ||
      !document.startViewTransition
    ) {
      activeTransition.current?.skipTransition()
      apply()
      return
    }

    // A second toggle may interrupt the first reveal without losing focus.
    activeTransition.current?.skipTransition()
    const trigger = document.activeElement?.getBoundingClientRect()
    const x = trigger ? trigger.left + trigger.width / 2 : window.innerWidth / 2
    const y = trigger ? trigger.top + trigger.height / 2 : window.innerHeight / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const transition = document.startViewTransition(apply)
    activeTransition.current = transition
    void transition.ready.then(() => {
      const css = getComputedStyle(document.documentElement)
      const duration = Number.parseFloat(css.getPropertyValue("--duration-moderate")) || 200
      const easing = css.getPropertyValue("--ease-out").trim() || "ease-out"
      try {
        document.documentElement.animate(
          [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
          ],
          { duration, easing, fill: "both", pseudoElement: "::view-transition-new(root)" },
        )
      } catch {
        // Unsupported pseudo-element animation: the class change still works.
      }
    }).catch(() => {})
    void transition.finished.finally(() => {
      if (activeTransition.current === transition) activeTransition.current = null
    })
  }

  const setHighContrast = (enabled: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled))
    }
    setHighContrastState(enabled)
  }

  // Apply theme class (dark/light)
  useEffect(() => {
    const resolved = resolve(theme)
    const root = document.documentElement
    if (root.classList.contains(resolved)) return
    root.classList.remove("dark", "light")
    root.classList.add(resolved)
  }, [theme])

  // Apply high-contrast class
  useEffect(() => {
    const root = document.documentElement
    if (highContrast) {
      root.classList.add("high-contrast")
    } else {
      root.classList.remove("high-contrast")
    }
  }, [highContrast])

  useEffect(() => {
    if (theme !== "system") return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const resolved = mql.matches ? "dark" : "light"
      document.documentElement.classList.remove("dark", "light")
      document.documentElement.classList.add(resolved)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: resolve(theme), highContrast, setHighContrast }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
