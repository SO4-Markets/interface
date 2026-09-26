import { Link } from "@tanstack/react-router"
import { ViewportReveal } from "../viewport-reveal"
import { PoolCard } from "./pool-card"
import { useLandingStats } from "./use-landing-stats"
import { cleanFormatUsd } from "./utils/formatters"

// Mirrors what /earn actually offers (apps/web/src/features/earn/data/pools.ts):
// GM pools (single-market liquidity) and GLV vaults (diversified across GM
// pools). No separate "stake SO4 for governance" product exists yet, so it's
// not claimed here. APY is genuinely 0 on GM pools until on-chain performance
// data lands — shown as "Accumulating..." rather than a fabricated number.
const POOLS = [
  { name: "GM", description: "Provide liquidity to a single market", apr: null },
  { name: "GLV · BTC-USDC", description: "Diversified across BTC and ETH pools", apr: 0.1017 },
  { name: "GLV · XLM-USDC", description: "Diversified exposure to the XLM pool", apr: 0.0843 },
]

export function LiquiditySection() {
  const stats = useLandingStats()

  return (
    <section className="bg-gmx-light-150 px-4 py-20 text-gmx-slate-900 sm:px-10 sm:py-30">
      <ViewportReveal className="mx-auto max-w-300">
        <h2 className="text-heading-2">
          {stats.liquidityTotal === null ? "-" : cleanFormatUsd(stats.liquidityTotal)} in liquidity
        </h2>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-18 font-medium tracking-[-0.896px] sm:text-28">Provide liquidity, earn real yield</p>
          <Link to="/earn" className="btn-landing inline-flex shrink-0 rounded-8 px-4 py-2.5 text-14">
            Start earning
          </Link>
        </div>

        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          {POOLS.map((pool) => (
            <PoolCard key={pool.name} {...pool} />
          ))}
        </div>
      </ViewportReveal>
    </section>
  )
}
