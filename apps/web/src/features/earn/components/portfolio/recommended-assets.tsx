import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { GLV_VAULTS, GM_POOLS } from "../../data/pools"
import { buySO4, depositGLV, depositGM } from "../../lib/earn"
import { formatPct } from "@/shared/lib/format"

const TOKEN_COLORS: Record<string, string> = {
  BTC: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  ETH: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
  XLM: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  USDC: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
  GLV: "bg-teal-500/10 text-teal-400 ring-teal-500/20",
  SO4: "bg-primary/10 text-primary ring-primary/20",
}

function TokenAvatar({
  symbol,
  size = "md",
}: {
  symbol: string
  size?: "sm" | "md" | "lg"
}) {
  const color = TOKEN_COLORS[symbol] ?? "bg-muted/60 text-muted-foreground ring-border"
  const dimensions = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-[11px]", lg: "h-11 w-11 text-sm" }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold ring-1",
        color,
        dimensions[size],
      )}
    >
      {symbol.slice(0, 2)}
    </div>
  )
}

function LightningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function SO4LogoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary">
      <path
        d="M4 6 L12 2 L20 6 L20 14 L12 18 L4 14 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M12 2 L12 18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6 L20 14" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <path d="M20 6 L4 14" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
    </svg>
  )
}

function SO4Card() {
  const [pending, setPending] = useState(false)

  function handleBuy() {
    setPending(true)
    buySO4()
    setTimeout(() => setPending(false), 500)
  }

  return (
    <div className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        SO4
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <SO4LogoIcon />
        </div>
        <div>
          <p className="text-[13px] font-semibold">SO4</p>
          <p className="text-[11px] text-muted-foreground">Accumulating…</p>
        </div>
      </div>
      <Button
        size="sm"
        className="h-8 w-full text-[12px]"
        disabled={pending}
        onClick={handleBuy}
      >
        Buy SO4
      </Button>
    </div>
  )
}

function GlvCard() {
  const vault = GLV_VAULTS[0]
  const [pending, setPending] = useState(false)

  async function handleEarn() {
    setPending(true)
    try {
      // TODO: pass real account + actual deposit amount from modal
      await depositGLV("DUMMY_ACCOUNT", `${vault.name} [${vault.displayPair}]`, 0)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        GLV vaults
      </p>
      <div className="flex items-center gap-3">
        <TokenAvatar symbol="GLV" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {vault.name}{" "}
            <span className="font-normal text-muted-foreground">[{vault.displayPair}]</span>
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-green-400">{formatPct(vault.apy, { sign: false })}</span>
            <span className="text-[10px] text-muted-foreground">Performance APY</span>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0 text-[12px]"
          disabled={pending}
          onClick={() => void handleEarn()}
        >
          {pending ? "…" : "Earn"}
        </Button>
      </div>
    </div>
  )
}

function GmCard() {
  const topPools = [...GM_POOLS].sort((a, b) => b.apy - a.apy).slice(0, 2)
  const [pending, setPending] = useState<string | null>(null)

  async function handleEarn(poolId: string, poolName: string) {
    setPending(poolId)
    try {
      // TODO: pass real account + actual deposit amount from modal
      await depositGM("DUMMY_ACCOUNT", poolName, 0)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          GM pools
        </p>
        <button className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          Explore more
          <ExternalLinkIcon />
        </button>
      </div>

      <div className="space-y-3">
        {topPools.map((pool) => (
          <div key={pool.id} className="flex items-center gap-3">
            <TokenAvatar symbol={pool.longToken} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium">{pool.name}</p>
              <p className="text-[10px] text-muted-foreground">
                [{pool.longToken}-{pool.shortToken}]
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-bold text-green-400">{formatPct(pool.apy, { sign: false })}</p>
              <p className="text-[10px] text-muted-foreground">Performance APY</p>
            </div>
            <Button
              size="sm"
              className="h-7 shrink-0 px-3 text-[11px]"
              disabled={pending === pool.id}
              onClick={() => void handleEarn(pool.id, pool.name)}
            >
              {pending === pool.id ? "…" : "Earn"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecommendedAssets() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LightningIcon />
        <h2 className="text-[15px] font-semibold">Recommended</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SO4Card />
        <GlvCard />
        <GmCard />
      </div>
    </div>
  )
}
