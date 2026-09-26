import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { HamburgerButton, SiteLogo, useMobileMenu } from "../nav/primitives"

const NAV_LINKS: Array<{
  label: string
  to: "/trade" | "/pools" | "/earn" | "/referrals"
}> = [
  { label: "Trade", to: "/trade" },
  { label: "Pools", to: "/pools" },
  { label: "Earn", to: "/earn" },
  { label: "Referrals", to: "/referrals" },
]

const SOCIALS = [
  { label: "X", href: "#" },
  { label: "Discord", href: "#" },
  { label: "Telegram", href: "#" },
  { label: "GitHub", href: "#" },
]

// "Open app" navigates, so it is a link styled as a button rather than a
// <button> — using Base UI's Button with render={<Link/>} strips native
// button semantics and warns about it.
function OpenAppButton({ className }: { className?: string }) {
  return (
    <Link
      to="/trade"
      className={`inline-flex items-center justify-center rounded-8 btn-landing px-4 py-2.5 text-14 ${className ?? ""}`}
    >
      Open app
    </Link>
  )
}

export function HeaderMenu() {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const desktopNavRef = useRef<HTMLUListElement>(null)
  const [instant, setInstant] = useState(false)
  const restoreTrigger = useCallback(() => {
    setInstant(true)
    triggerRef.current?.focus()
  }, [])
  const { open, toggle, close } = useMobileMenu(restoreTrigger)

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 640px)")
    const onBreakpointChange = () => {
      if (desktop.matches && open) {
        close()
        desktopNavRef.current?.querySelector<HTMLElement>("a")?.focus()
      }
    }
    desktop.addEventListener("change", onBreakpointChange)
    return () => desktop.removeEventListener("change", onBreakpointChange)
  }, [close, open])

  // The mobile menu is a full-screen overlay, so it needs the two things
  // an overlay owes a keyboard/screen-reader user beyond Escape-to-close
  // (which useMobileMenu already handles): the page behind it must not
  // scroll, and Tab must not walk out of it into that inert content.
  useEffect(() => {
    if (!open) return

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = "hidden"

    const panel = panelRef.current
    panel?.querySelector<HTMLElement>("a, button")?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return

      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <header className="fixed top-0 z-30 w-full bg-gmx-slate-900">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-4 sm:px-10">
        {/* SiteLogo renders its own <a href="/"> — do not wrap it in
            another anchor (nested <a> is invalid HTML and breaks
            hydration for the whole route). */}
        <div className="flex h-5 min-w-0 flex-1 items-center overflow-hidden sm:h-6">
          <SiteLogo variant="landing" />
        </div>

        {/* Desktop nav */}
        <ul ref={desktopNavRef} className="hidden items-center gap-5.5 sm:flex">
          {NAV_LINKS.map(({ label, to }) => (
            <li key={label}>
              <Link
                to={to}
                className="text-14 font-medium tracking-[-0.448px] text-white/80 transition-colors duration-180 hover:text-white [&.active]:text-white/60"
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href="#"
              className="text-14 font-medium tracking-[-0.448px] text-white/80 transition-colors duration-180 hover:text-white"
            >
              Docs
            </a>
          </li>
        </ul>

        <div className="flex shrink-0 items-center gap-3">
          <OpenAppButton className="hidden sm:inline-flex" />
          <HamburgerButton
            open={open}
            controls="landing-mobile-menu"
            buttonRef={triggerRef}
            className="sm:hidden"
            onToggle={(event) => {
              setInstant(event.detail === 0)
              toggle()
            }}
          />
        </div>
      </div>

      {/* Mobile full-screen menu */}
      <div
        id="landing-mobile-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        data-instant={instant}
        className="landing-mobile-menu fixed inset-0 top-16 z-20 flex flex-col bg-gmx-slate-900 sm:hidden"
      >
        <ul className="flex flex-1 flex-col overflow-y-auto px-4">
          {NAV_LINKS.map(({ label, to }) => (
            <li
              key={label}
              className="border-hairline border-t border-gmx-slate-600"
            >
              <Link
                to={to}
                className="block py-4 text-16 font-medium text-white"
                onClick={close}
              >
                {label}
              </Link>
            </li>
          ))}
          <li className="border-hairline border-t border-gmx-slate-600">
            <a
              href="#"
              className="block py-4 text-16 font-medium text-white"
              onClick={close}
            >
              Docs
            </a>
          </li>
        </ul>
        <div className="px-4 pb-2">
          <OpenAppButton className="w-full justify-center" />
        </div>
        <div className="border-hairline border-t border-gmx-slate-600 px-4 py-5">
          <p className="text-12 text-gmx-slate-500">Driven by our community</p>
          <div className="mt-3 flex gap-4">
            {SOCIALS.map(({ label, href }) => (
              <a key={label} href={href} className="text-12 text-gmx-slate-400">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
