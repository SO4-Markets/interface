import { Link } from "@tanstack/react-router"
import { AnimatedTitle } from "./animated-title"
import { FeatureGrid } from "./feature-grid"
import { useLandingStats } from "./use-landing-stats"
import { useHeroFirstLoadSequence } from "./hooks/useHeroFirstLoadSequence"
import { shortFormat, shortFormatUsd } from "./utils/formatters"

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-12 text-gmx-slate-400 sm:text-14">{label}</div>
      <div className="mt-1 text-30 font-medium tracking-tight text-white sm:text-40">{value}</div>
    </div>
  )
}

// GMX's "Total volume" stat links out to a Dune analytics dashboard. SO4
// has no equivalent analytics page to link to, so this renders as a plain
// stat like the other two rather than a hover-link affordance that goes
// nowhere real.
// TODO(GF3-003): make this a real link once SO4 has an analytics/stats page.

export function HeroSection() {
  const stats = useLandingStats()
  const sequence = useHeroFirstLoadSequence()

  return (
    <section className="relative overflow-hidden bg-gmx-slate-900">
      {/* GMX's hero has an animated chain-constellation canvas behind an
          off-center glow (upper-right of the headline, per
          docs/gf_3/screenshots/hero-desktop.png) — the canvas animation
          itself isn't recreated (no asset/JS budget for it here), but the
          glow's position now matches the reference instead of the centered
          placeholder GF3-002 shipped. */}
      <div
        className="absolute inset-x-0 top-0 h-160 bg-[radial-gradient(circle_at_75%_15%,var(--color-gmx-slate-700),transparent_55%)] sm:h-215"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-160 w-full max-w-300 flex-col justify-end px-4 pt-20 pb-15 sm:min-h-215 sm:px-10 sm:pt-24 sm:pb-20">
        <h1
          className={`text-heading-1 text-white transition-opacity duration-300 ${
            sequence.showTitle ? "opacity-100" : "opacity-0"
          }`}
        >
          Trade <AnimatedTitle /> on verified order book
        </h1>

        {/* The CTA + subheadline + 3-stat group only fit on one line once
            there is desktop room for them, so the row is deferred to `lg`.
            Between 640 and 1023 the stats sit on their own line instead of
            being squeezed into a third column (which wrapped every stat
            label onto three lines at 768). */}
        <div
          className={`mt-7 flex flex-col gap-6 border-b border-hairline border-gmx-slate-600 pb-7 lg:flex-row lg:items-end lg:justify-between lg:pb-9 transition-opacity duration-300 ${
            sequence.showCta ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-9">
            <Link to="/trade" className="btn-landing flex w-full items-center justify-center rounded-8 px-6 py-3 text-14 sm:w-50">
              Trade now
            </Link>

            <p className="text-subheadline sm:w-56.5">
              Stellar-native order book trading with verified settlement, sub-5-second finality,
              and market-making pools.
            </p>
          </div>

          <div className="flex gap-9 sm:gap-15">
            <Stat label="Traders" value={stats.traders === null ? "-" : shortFormat(stats.traders)} />
            <Stat
              label="Open interest"
              value={stats.openInterest === null ? "-" : shortFormatUsd(stats.openInterest)}
            />
            <Stat
              label="Total volume"
              value={stats.totalVolume === null ? "-" : shortFormatUsd(stats.totalVolume)}
            />
          </div>
        </div>
      </div>

      <div
        className={`relative mx-auto w-full max-w-300 px-4 sm:px-10 transition-opacity duration-300 ${
          sequence.showGrid ? "opacity-100" : "opacity-0"
        }`}
      >
        <FeatureGrid />
      </div>
    </section>
  )
}
