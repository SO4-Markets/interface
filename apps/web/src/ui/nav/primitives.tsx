import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import type { MouseEvent, Ref } from "react"

// ── Shared classes ──

export const navOuterClass =
  "sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md backdrop-saturate-150"

export const containerClass =
  "mx-auto flex min-w-0 items-center justify-between gap-2 px-3 sm:px-6 lg:px-8"

export const desktopLinkClass =
  "relative inline-flex h-8 items-center rounded-md px-2 text-13-5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"

export const desktopActiveLinkClass =
  "relative inline-flex h-8 items-center rounded-md bg-primary/10 px-2 text-13-5 font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary"

export const mobileLinkClass =
  "block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"

export const mobileActiveLinkClass =
  "block rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-foreground ring-1 ring-primary/20"

// ── Logo ──

interface SiteLogoProps {
  variant?: "app" | "landing"
}

export function SiteLogo({ variant = "app" }: SiteLogoProps) {
  const content = (
    <>
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
          <path
            d="M4 5.5 12 2l8 3.5v13L12 22l-8-3.5v-13Z"
            stroke="currentColor"
            strokeWidth="1.25"
            fill="currentColor"
            fillOpacity="0.08"
            className="text-primary"
          />
          <path
            d="M7 8.5h4.2c2.4 0 4 1.2 4 3.2s-1.6 3.2-4 3.2H9.5V19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />
        </svg>
      </span>
      <span className="font-mono-num text-17 font-medium tracking-[0.02em] text-foreground">
 ob-031-034-035-032-trading-workspace
        levee<span className="text-muted-foreground max-[380px]:hidden">.market</span>

        so4
        <span className="text-muted-foreground max-[380px]:hidden">
          .market
        </span>
 main
      </span>
    </>
  )

  if (variant === "app") {
    return (
      <Link to="/" className="flex items-center gap-2.5 tracking-[-0.02em]">
        {content}
      </Link>
    )
  }

  return (
    <a href="/" className="flex items-center gap-2.5 tracking-[-0.02em]">
      {content}
    </a>
  )
}

// ── Hamburger ──

interface HamburgerButtonProps {
  open: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  buttonRef?: Ref<HTMLButtonElement>
  controls?: string
  className?: string
}

export function HamburgerButton({
  open,
  onToggle,
  buttonRef,
  controls,
  className = "md:hidden",
}: HamburgerButtonProps) {
  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      className={className}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      {open ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      )}
    </Button>
  )
}

// ── Mobile menu hook ──

export function useMobileMenu(onEscape?: () => void) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.()
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onEscape, open])

  return { open, toggle, close }
}
