import { IconBox } from "./icon-box"
import { percentFormat } from "./utils/formatters"

export type PoolCardData = {
  name: string
  description: string
  apr: number | null
}

// Decorative — the pool name right below it already conveys the meaning.
function CoinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  )
}

// GMX's PoolCard has a diagonal-line parallax texture behind a gradient
// cover, plus a coin image bottom-right that scales on hover — recreated as
// inline SVG/CSS since GMX's actual assets aren't in the public repo.
function ParallaxLines() {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.06] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1"
      aria-hidden="true"
    >
      <pattern
        id="pool-card-lines"
        width="18"
        height="18"
        patternTransform="rotate(35)"
        patternUnits="userSpaceOnUse"
      >
        <line x1="0" y1="0" x2="0" y2="18" stroke="white" strokeWidth="1" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#pool-card-lines)" />
    </svg>
  )
}

export function PoolCard({ name, description, apr }: PoolCardData) {
  return (
    <div className="group relative flex h-50 w-full flex-1 flex-col justify-between overflow-hidden rounded-20 bg-gmx-slate-800 p-6 motion-safe:transition-transform motion-safe:duration-180 motion-safe:hover:-translate-y-1 lg:h-95 lg:max-w-96 lg:p-9">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,var(--color-gmx-blue-400)/0.15,transparent_60%)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
        aria-hidden="true"
      />
      <ParallaxLines />
      {/* Coin mark, bottom-right, scales on hover like GMX's coin image */}
      <div
        className="absolute -right-4 -bottom-4 size-28 rounded-full border border-white/10 bg-gmx-blue-400/10 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110 lg:size-36"
        aria-hidden="true"
      />

      <div className="relative">
        <IconBox>
          <CoinIcon />
        </IconBox>
        <h3 className="mt-6 text-24 font-medium tracking-[-0.896px] text-white lg:mt-9">
          {name}
        </h3>
        <p className="mt-2 text-14 text-gmx-slate-400">{description}</p>
      </div>

      <div className="relative text-14 text-gmx-slate-400">
        {apr === null ? "Accumulating..." : percentFormat(apr)}
      </div>
    </div>
  )
}
