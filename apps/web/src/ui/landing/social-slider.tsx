// The reference marquee shows real, attributed posts. SO4 has no curated
// testimonials — inventing quotes under fake @handles would present
// fabricated social proof as if it were real, which is worse than not
// having a marquee at all. This shows real, verifiable statements about the
// product instead (sourced from README.md / the feature set), framed as
// product highlights rather than attributed to people who don't exist.
// Keep all highlights visible instead of duplicating and auto-scrolling them.
// TODO(GF3-003): replace with real, curated community posts once any exist.
const CARDS = [
  {
    label: "Self-custodied",
    text: "No deposits to a custodian. Your keys, your collateral, every trade.",
  },
  {
    label: "Unified liquidity",
    text: "One pool backs every market — fills aren't limited by order book depth.",
  },
  {
    label: "Open source",
    text: "Contracts and indexer are public on GitHub. Verify what you're trading against.",
  },
]

function SocialCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-6">
      <div className="flex items-center gap-2">
        <span
          className="size-8 rounded-full bg-gmx-blue-400/20"
          aria-hidden="true"
        />
        <span className="text-14 font-medium text-white">{label}</span>
      </div>
      <p className="text-14 text-gmx-slate-400">{text}</p>
    </div>
  )
}

export function SocialSlider() {
  return (
    <div className="mx-auto grid max-w-300 grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-10">
      {CARDS.map((card) => (
        <SocialCard key={card.label} {...card} />
      ))}
    </div>
  )
}
