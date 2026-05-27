import { useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { usePoolsApy } from "../../hooks/use-earn-data"
import { depositGLV, depositGM } from "../../lib/earn"
import { formatPct, formatUsd } from "@/shared/lib/format"
import { useMarketPoolAmounts } from "../../hooks/useMarketPoolAmounts"
import { useGLVVaultData, useGMPoolData } from "../../queries"
import { fromSorobanAmount } from "@/shared/lib/bignum"

type Filter = "all" | "glv" | "gm"
type SortKey = "apy" | "tvl"



const TOKEN_COLORS: Record<string, string> = {
  BTC: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  ETH: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
  XLM: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  GLV: "bg-teal-500/10 text-teal-400 ring-teal-500/20",
}

function TokenAvatar({ symbol }: { symbol: string }) {
  const color = TOKEN_COLORS[symbol] ?? "bg-muted/60 text-muted-foreground ring-border"
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1",
        color,
      )}
    >
      {symbol.slice(0, 2)}
    </div>
  )
}

function PoolCompositionBar({ longPct, shortPct }: { longPct: number; shortPct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-blue-400/70" style={{ width: `${longPct}%` }} />
        <div className="h-full bg-amber-400/70" style={{ width: `${shortPct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {longPct}% / {shortPct}%
      </p>
    </div>
  )
}

type FilterButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

type SortButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function SortButton({ active, onClick, children }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[12px] transition-colors",
        active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function DiscoverTab() {
  const { gmPools, glvVaults } = usePoolsApy()
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<SortKey>("apy")
  const [pending, setPending] = useState<string | null>(null)

  const rows = useMemo(() => {
    const combined = [
      ...glvVaults.map((v) => ({
        id: v.id,
        marketAddress: "",
        vaultAddress: v.id,
        name: `${v.name} [${v.displayPair}]`,
        kind: "glv" as const,
        longToken: "GLV",
        apy: v.apy,
        tvlUsd: v.tvlUsd,
        longPct: undefined as number | undefined,
        shortPct: undefined as number | undefined,
      })),
      ...gmPools.map((p) => ({
        id: p.id,
        marketAddress: p.marketAddress,
        vaultAddress: "",
        name: p.name,
        kind: "gm" as const,
        longToken: p.longToken,
        apy: p.apy,
        tvlUsd: p.tvlUsd,
        longPct: p.longPct,
        shortPct: p.shortPct,
      })),
    ]

    return combined
      .filter((r) => filter === "all" || r.kind === filter)
      .sort((a, b) => (sort === "apy" ? b.apy - a.apy : b.tvlUsd - a.tvlUsd))
  }, [gmPools, glvVaults, filter, sort])

  async function handleEarn(id: string, kind: "gm" | "glv", name: string) {
    setPending(id)
    try {
      // TODO: open deposit modal with amount input instead of calling directly
      if (kind === "gm") await depositGM("DUMMY_ACCOUNT", name, 0)
      else await depositGLV("DUMMY_ACCOUNT", name, 0)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterButton>
          <FilterButton active={filter === "glv"} onClick={() => setFilter("glv")}>
            GLV
          </FilterButton>
          <FilterButton active={filter === "gm"} onClick={() => setFilter("gm")}>
            GM
          </FilterButton>
        </div>

        <div className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground">
          <span>Sort</span>
          <SortButton active={sort === "apy"} onClick={() => setSort("apy")}>
            APY {sort === "apy" && "↓"}
          </SortButton>
          <span className="text-border">·</span>
          <SortButton active={sort === "tvl"} onClick={() => setSort("tvl")}>
            TVL {sort === "tvl" && "↓"}
          </SortButton>
        </div>
      </div>

      {/* Pool table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/25 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Pool</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">APY</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">TVL</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Position</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Composition</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <DiscoverRow
                  key={row.id}
                  row={row}
                  isLast={i === rows.length - 1}
                  pending={pending}
                  onEarn={handleEarn}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-400/70" />
          Long token
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          Short token
        </div>
        <p className="ml-auto text-[11px] text-muted-foreground">
          APY based on trailing 30-day performance
        </p>
      </div>
    </div>
  )
}

function DiscoverRow({
  row,
  isLast,
  pending,
  onEarn,
}: {
  row: {
    id: string
    marketAddress: string
    vaultAddress: string
    name: string
    kind: "glv" | "gm"
    longToken: string
    apy: number
    tvlUsd: number
    longPct: number | undefined
    shortPct: number | undefined
  }
  isLast: boolean
  pending: string | null
  onEarn: (id: string, kind: "gm" | "glv", name: string) => Promise<void>
}) {
  const { data: poolAmounts } = useMarketPoolAmounts(row.marketAddress)
  const { data: gmPoolData } = useGMPoolData(row.marketAddress)
  const { data: glvVaultData } = useGLVVaultData(row.vaultAddress)
  const liveData = row.kind === "gm" ? gmPoolData : glvVaultData
  const tvl = row.kind === "gm" ? (poolAmounts?.poolValueUsd ?? liveData?.tvlUsd ?? row.tvlUsd) : (liveData?.tvlUsd ?? row.tvlUsd)
  const apy = liveData?.apr ?? row.apy
  const longPct = row.kind === "gm" ? (gmPoolData?.longPct ?? row.longPct) : row.longPct
  const shortPct = row.kind === "gm" ? (gmPoolData?.shortPct ?? row.shortPct) : row.shortPct
  const userBalance = row.kind === "gm"
    ? fromSorobanAmount(gmPoolData?.userGmBalance ?? 0n, 7)
    : fromSorobanAmount(glvVaultData?.userGlvBalance ?? 0n, 7)

  return (
    <tr className={cn("transition-colors hover:bg-muted/20", !isLast && "border-b border-border/40")}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <TokenAvatar symbol={row.longToken} />
          <span className="font-medium">{row.name}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium",
            row.kind === "glv"
              ? "border-teal-500/20 bg-teal-500/10 text-teal-400"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
          )}
        >
          {row.kind.toUpperCase()}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <span className="font-mono font-semibold text-green-400">{formatPct(apy, { sign: false })}</span>
      </td>
      <td className="px-5 py-4 text-right font-mono text-muted-foreground">
        {formatUsd(tvl, { compact: true })}
      </td>
      <td className="px-5 py-4 text-right font-mono text-muted-foreground">
        {userBalance > 0 ? userBalance.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}
      </td>
      <td className="px-5 py-4">
        {longPct !== undefined ? (
          <PoolCompositionBar longPct={longPct} shortPct={shortPct ?? 0} />
        ) : (
          <span className="text-[11px] text-muted-foreground">Diversified</span>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <Button size="xs" disabled={pending === row.id} onClick={() => void onEarn(row.id, row.kind, row.name)}>
          {pending === row.id ? "…" : "Earn"}
        </Button>
      </td>
    </tr>
  )
}
