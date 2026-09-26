import { Link } from "@tanstack/react-router"
import { Icon } from "@workspace/ui/components/icon"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { IconBox } from "./icon-box"

const CHIPS = ["No deposits required", "Trade from your wallet", "No loss of fund ownership"]

// The three markets SO4 actually lists (README.md): BTC, ETH, XLM. Each
// asset's identity color is fixed by convention (Bitcoin orange, Ethereum
// lavender, Stellar blue) — not a UI decoration, so it can't be sourced
// from the design-token palette.
const ASSET_MARKS = [
  { symbol: "BTC", from: "#F7931A", to: "#B36B0F" }, // ds-allow: Bitcoin brand color, not a UI token
  { symbol: "ETH", from: "#8296FF", to: "#3C4CB0" }, // ds-allow: Ethereum brand color, not a UI token
  { symbol: "XLM", from: "#14B6E7", to: "#0B6E93" }, // ds-allow: Stellar brand color, not a UI token
]

// Both decorative — each sits beside a card heading that already names the
// feature, so the icon adds nothing a screen reader needs to announce.
function GearsIcon() {
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
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M9 3v2m0 8v2m6-6h-2M5 9H3m4.24-4.24L5.83 3.34m6.34 6.34 1.41-1.41" />
    </svg>
  )
}

function ShieldIcon() {
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
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
    </svg>
  )
}

export function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 py-20 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3 lg:py-30">
      {/* Visually part of the hero (no visible section title, matching
          GMX), but the card h3s below need an h2 ancestor to keep the
          heading outline valid — Lighthouse's heading-order audit failed
          without this, since h1 → h3 skips a level. */}
      <h2 className="sr-only">Why trade on SO4</h2>

      {/* Market-making pools */}
      <div className="rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-9">
        <IconBox>
          <GearsIcon />
        </IconBox>
        <div className="mt-9 border-t border-hairline border-gmx-slate-600 pt-6">
          <p className="text-12 uppercase tracking-[0.864px] text-gmx-slate-500">Verified settlement</p>
          <h3 className="mt-2 text-heading-4 text-white">Stellar order book</h3>
          <p className="mt-3 text-description">
            Trade on a real-time order book with on-chain settlement backed by Stellar Soroban.
            Every order executes and settles directly on-chain.
          </p>
        </div>
      </div>

      {/* Sub-5-second finality — blue card, spans 2 rows */}
      <div className="relative overflow-hidden rounded-20 bg-gmx-blue-400 p-9 lg:row-span-2">
        <IconBox>
          <ShieldIcon />
        </IconBox>
        <div className="mt-9">
          <h3 className="text-heading-4 text-white">Fast, predictable settlement</h3>
          {/* white/70 on this blue card measured 3.86:1 (Lighthouse
              color-contrast audit) against the WCAG AA 4.5:1 minimum;
              white/85 clears it with margin. */}
          <p className="mt-3 text-16 text-white/85">
            Stellar's network provides sub-5-second finality with fixed, predictable fees.
            Know your costs before you trade.
          </p>
        </div>
        {/* Decorative shield-and-pulse mark, not a data illustration —
            aria-hidden is correct here. */}
        <svg
          className="mt-6 w-3/5"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden="true"
          width="120"
          height="120"
        >
          <path
            d="M60 8 L104 26 V56 C104 84 86 104 60 114 C34 104 16 84 16 56 V26 Z"
            fill="white"
            fillOpacity="0.08"
            stroke="white"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          <path
            d="M60 30 L86 42 V58 C86 76 76 89 60 96 C44 89 34 76 34 58 V42 Z"
            fill="white"
            fillOpacity="0.1"
          />
          <path
            d="M48 60 L57 69 L74 50"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Markets live on Stellar — spans 2 rows */}
      <div className="rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-9 lg:row-span-2">
        <IconBox>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </IconBox>
        <div className="mt-9">
          <h3 className="text-heading-4 text-white">Stellar native assets</h3>
          <p className="mt-3 text-description">Trade major assets with liquidity from Stellar-based pools and market makers.</p>
        </div>
        {/* Three asset marks (BTC · ETH · XLM) — matches the markets SO4
            actually lists (README.md), not a generic multi-chain claim. */}
        <div className="mt-6 flex flex-wrap gap-2" role="img" aria-label="Supported assets: Bitcoin, Ethereum, Stellar Lumens">
          {ASSET_MARKS.map(({ symbol, from, to }) => (
            <span
              key={symbol}
              className="flex size-10 items-center justify-center rounded-full text-11 font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            >
              {symbol}
            </span>
          ))}
        </div>
      </div>

      {/* Minimal fees */}
      <div className="rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-9">
        <IconBox>
          <ShieldIcon />
        </IconBox>
        <div className="mt-9 border-t border-hairline border-gmx-slate-600 pt-6">
          <p className="text-12 uppercase tracking-[0.864px] text-gmx-slate-500">Network efficiency</p>
          <h3 className="mt-2 text-heading-4 text-white">Minimal fees</h3>
          <p className="mt-3 text-description">
            Trade on Stellar with fixed, predictable network fees. No surprises at settlement.
          </p>
        </div>
      </div>

      {/* Secure & permissionless */}
      <div className="rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-9">
        <h3 className="text-heading-4 text-white">Secure &amp; permissionless</h3>
        <div className="mt-5 flex flex-col gap-2.5">
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-2 rounded-8 bg-gmx-slate-650/50 px-3 py-2 text-14 text-white"
            >
              <Icon icon={Tick02Icon} size="sm" className="text-gmx-blue-400" />
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Order book trading — wide CTA card, spans 2 cols */}
      <div className="relative overflow-hidden rounded-20 bg-linear-to-br from-gmx-slate-800 to-gmx-slate-650 p-9 sm:col-span-2">
        <h3 className="text-heading-4 max-w-[420px] text-white">Order book trading</h3>
        <p className="mt-3 max-w-[420px] text-description">
          View live depth, place limit and market orders, track your fills in real time.
          Every trade settles immediately on Stellar.
        </p>
        <Link to="/trade" className="btn-landing mt-6 inline-flex rounded-8 px-4 py-2.5 text-14">
          Start trading
        </Link>
      </div>
    </div>
  )
}
