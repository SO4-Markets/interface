import { Link } from "@tanstack/react-router"
import { ViewportReveal } from "../viewport-reveal"

// GMX's LaunchSection is a grid of separate chains it deploys to. SO4 is
// Stellar-native — Soroban is Stellar's smart-contract layer, not a second
// chain — so a multi-entry grid would misrepresent the protocol. One real
// card instead of a padded-out list.
function StellarMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#08B5E5" /> {/* ds-allow: Stellar brand color, not a UI token */}
      <path
        d="M6.5 15.5 17.5 8.5M6.5 15.5l3-1.2M6.5 15.5l1.2-3M17.5 8.5l-3 1.2M17.5 8.5l-1.2 3"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LaunchSection() {
  return (
    <section className="bg-white px-4 py-20 text-gmx-slate-900 sm:px-10 sm:py-30">
      <ViewportReveal className="mx-auto flex max-w-300 flex-col gap-6 lg:flex-row lg:items-center">
        <div className="lg:w-1/2">
          <h2 className="text-heading-2">Runs entirely on Stellar</h2>
          {/* gmx-slate-500 is a dark-surface muted-text token (001_theme_update.md
              §3: "Muted text (footer links, social labels)" on slate-900) — at
              2.46:1 against this light band it fails WCAG contrast entirely.
              text-gmx-slate-900/70 keeps the same "secondary text" hierarchy
              while staying readable on white. */}
          <p className="mt-4 text-18 text-gmx-slate-900/70">
            Built on Soroban, Stellar&apos;s smart-contract platform — open, permissionless
            settlement with sub-5-second finality and fixed, predictable network fees.
          </p>
          <Link to="/trade" className="btn-landing mt-6 inline-flex rounded-8 px-4 py-2.5 text-14">
            Open app
          </Link>
        </div>
        <div className="lg:w-1/2">
          <a
            href="https://stellar.org"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-8 border border-hairline border-gmx-slate-600/20 bg-white px-4 py-3.5 text-gmx-slate-900 shadow-sm transition-colors duration-180 hover:bg-gmx-light-150"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-gmx-light-150">
                <StellarMark />
              </span>
              <span className="text-14 font-medium">Stellar &amp; Soroban</span>
            </span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </ViewportReveal>
    </section>
  )
}
