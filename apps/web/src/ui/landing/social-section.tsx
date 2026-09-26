import { NewsletterForm } from "./newsletter-form"
import { SocialSlider } from "./social-slider"

// Counts stay "-" — no social account has a real follower count to report
// yet, and a fabricated number is worse than an honest placeholder. URLs
// point at the same handles __root.tsx's JSON-LD already claims
// (twitter.com/so4market, discord.gg/so4market, t.me/so4market) so at least
// the page is internally consistent; GitHub is the one link that's
// definitely real (this repo).
const SOCIAL_STATS = [
  { name: "Discord", value: "-", href: "https://discord.gg/so4market" },
  { name: "X", value: "-", href: "https://twitter.com/so4market" },
  { name: "Telegram", value: "-", href: "https://t.me/so4market" },
  { name: "GitHub", value: "Join", href: "https://github.com/Levee-HQ/interface" },
]

// GMX's referral-terms/media-kit/terms pages don't exist for SO4 yet — no
// destination to send these to, so they're left "#" rather than pointing
// somewhere wrong.
// TODO(GF3-003): wire once SO4 publishes referral terms / media kit / ToS.
const FOOTER_LINKS = [
  { label: "Referral terms", href: "#" },
  { label: "Media kit", href: "#" },
  { label: "Terms and conditions", href: "#" },
]

export function SocialSection() {
  return (
    <section className="border-t border-hairline border-gmx-slate-600 bg-gmx-slate-900 sm:border-t">
      <div className="py-20 sm:py-30">
        <SocialSlider />
      </div>

      <div className="mx-auto max-w-300 px-4 sm:px-10">
        <h2 className="text-heading-1 text-white">
          Driven by
          <br />
          our community.
        </h2>

        <div className="mt-9 flex flex-col gap-9 border-t border-hairline border-gmx-slate-600 pt-9 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-9">
            {SOCIAL_STATS.map(({ name, value, href }) => (
              <a key={name} href={href} target="_blank" rel="noreferrer" className="group">
                <div className="text-14 text-gmx-slate-500 transition-colors duration-180 group-hover:text-gmx-blue-300 group-focus-visible:text-gmx-blue-300">
                  {name}
                </div>
                <div className="mt-1 text-40 font-medium text-white">{value}</div>
              </a>
            ))}
          </div>

          <NewsletterForm />
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-hairline border-gmx-slate-600 py-5 sm:flex-row sm:justify-center sm:gap-3">
          {FOOTER_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-12 font-medium text-gmx-slate-500 transition-colors duration-180 hover:text-white active:text-white/80"
            >
              {label}
            </a>
          ))}
          {/* SO4's chart is lightweight-charts (an independent open-source
              library), not a TradingView-branded product — GMX's own
              attribution doesn't apply here, so it isn't copied. */}
          <span className="flex items-center gap-1 text-12 font-medium text-gmx-slate-500">
            Charts by lightweight-charts
          </span>
        </div>
      </div>
    </section>
  )
}
