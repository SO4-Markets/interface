import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { ThemeToggle } from "./theme-toggle"
import {
  HamburgerButton,
  SiteLogo,
  containerClass,
  desktopActiveLinkClass,
  desktopLinkClass,
  mobileActiveLinkClass,
  mobileLinkClass,
  navOuterClass,
  useMobileMenu,
} from "./nav/primitives"
import { ConnectButton } from "@/features/wallet/components/ConnectButton"
import { WhatsNew } from "@/features/changelog/components/WhatsNew"
import { WhatsNewDot } from "@/features/changelog/components/WhatsNewDot"
import { useWhatsNewIndicator } from "@/features/changelog/whats-new"

const LANDING_LINKS = [
  { label: "Trade", href: "/trade" },
  { label: "Earn", href: "/earn" },
  { label: "Stats", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Governance", href: "#" },
]

const APP_LINKS: Array<{
  label: string
  to: "/trade" | "/pools" | "/earn" | "/referrals" | "/faucet" | "/changelog" | null
  whatsNew?: boolean
}> = [
  { label: "Trade", to: "/trade" },
  { label: "Pools", to: "/pools" },
  { label: "Earn", to: "/earn" },
  { label: "Referrals", to: "/referrals" },
  { label: "Faucet", to: "/faucet" },
  { label: "Stats", to: null },
  { label: "Docs", to: null },
  { label: "Changelog", to: "/changelog", whatsNew: true },
]

type Props = {
  variant: "landing" | "app"
}

export function Navbar({ variant }: Props) {
  const { open, toggle, close } = useMobileMenu()
  const isApp = variant === "app"
  // DX-016: dot on the changelog nav item when a major/minor release shipped.
  const hasNewReleases = useWhatsNewIndicator()

  return (
    <nav className={navOuterClass}>
      <div
        className={`${containerClass} ${
          isApp ? "h-14 max-w-full" : "h-16 max-w-330"
        }`}
      >
        <div className="min-w-0 shrink">
          <SiteLogo variant={variant} />
        </div>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 md:flex">
          {isApp
            ? APP_LINKS.map(({ label, to, whatsNew }) => (
                <li key={label}>
                  {to ? (
                    <Link
                      to={to}
                      className={desktopLinkClass}
                      activeOptions={{ exact: true }}
                      activeProps={{ className: desktopActiveLinkClass }}
                      aria-label={
                        whatsNew && hasNewReleases
                          ? `${label} — new releases`
                          : undefined
                      }
                    >
                      {label}
                      <WhatsNewDot show={Boolean(whatsNew && hasNewReleases)} />
                    </Link>
                  ) : (
                    <span className="cursor-default text-13-5 text-muted-foreground/40">
                      {label}
                    </span>
                  )}
                </li>
              ))
            : LANDING_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className={desktopLinkClass}>
                    {label}
                  </a>
                </li>
              ))}
        </ul>

        {/* Actions */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          {isApp && <WhatsNew />}
          <ThemeToggle />
          <ConnectButton />
          {!isApp && (
            <Button
              variant="default"
              className="hidden h-9.5 gap-2 btn-landing px-4 text-13-5 sm:inline-flex"
            >
              Launch app
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Button>
          )}
          <HamburgerButton open={open} onToggle={toggle} />
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {isApp
              ? APP_LINKS.map(({ label, to, whatsNew }) => (
                  <li key={label}>
                    {to ? (
                      <Link
                        to={to}
                        className={mobileLinkClass}
                        activeOptions={{ exact: true }}
                        activeProps={{ className: mobileActiveLinkClass }}
                        aria-label={
                          whatsNew && hasNewReleases
                            ? `${label} — new releases`
                            : undefined
                        }
                        onClick={close}
                      >
                        {label}
                        <WhatsNewDot show={Boolean(whatsNew && hasNewReleases)} />
                      </Link>
                    ) : (
                      <span className="block rounded py-2 text-sm text-muted-foreground/40">
                        {label}
                      </span>
                    )}
                  </li>
                ))
              : LANDING_LINKS.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="block rounded py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={close}
                    >
                      {label}
                    </a>
                  </li>
                ))}
          </ul>
          {!isApp && (
            <Button variant="default" className="mt-3 w-full gap-2 btn-landing">
              Launch app →
            </Button>
          )}
        </div>
      )}
    </nav>
  )
}
