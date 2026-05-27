import { useEffect, useRef, useState } from "react"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { usePriceDelta24h } from "../../hooks/usePriceDelta24h"
import { useMarkets } from "../../hooks/useMarkets"
import type { Market } from "../../hooks/useMarkets"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  onSelect: (indexTokenAddress: string) => void
}

function MarketRow({
  market,
  isActive,
  onSelect,
}: {
  market: Market
  isActive: boolean
  onSelect: () => void
}) {
  const { getMidPrice } = useTokenPrices()
  const { data: delta } = usePriceDelta24h(market.indexTokenAddress)
  const price = getMidPrice(market.indexTokenAddress)
  const isPositive = (delta?.deltaPercentage ?? 0) > 0
  const isNegative = (delta?.deltaPercentage ?? 0) < 0

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-4 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
        isActive ? "bg-accent/60" : ""
      }`}
    >
      <span className={`font-medium ${isActive ? "text-foreground" : "text-foreground/80"}`}>
        {market.name}
      </span>
      <div className="flex items-center gap-3 text-right">
        <span className="font-mono text-xs text-foreground">
          {price > 0
            ? formatUsd(price, { decimals: 4 })
            : "—"}
        </span>
        <span
          className={`w-16 font-mono text-xs ${
            isPositive
              ? "text-green-500"
              : isNegative
                ? "text-red-500"
                : "text-muted-foreground"
          }`}
        >
          {delta?.deltaPercentageStr ?? "—"}
        </span>
      </div>
    </button>
  )
}

export function MarketSelector({ symbol, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const { markets } = useMarkets()

  const activeMarket = markets.find((m) => m.indexTokenAddress === symbol)

  const filtered = markets.filter((m) =>
    search.trim() === ""
      ? true
      : m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.indexTokenAddress.toLowerCase().includes(search.toLowerCase()),
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-accent"
      >
        <span className="text-sm font-semibold text-foreground">
          {activeMarket?.name ?? symbol ?? "Select Market"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets..."
              className="w-full rounded bg-background px-2.5 py-1.5 text-xs text-foreground outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-primary"
            />
          </div>
          <div className="px-1 pb-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No markets found
              </p>
            ) : (
              filtered.map((market) => (
                <MarketRow
                  key={market.address}
                  market={market}
                  isActive={market.indexTokenAddress === symbol}
                  onSelect={() => {
                    onSelect(market.indexTokenAddress)
                    setOpen(false)
                    setSearch("")
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
