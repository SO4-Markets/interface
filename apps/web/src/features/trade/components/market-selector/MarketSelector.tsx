import { useEffect, useRef, useState } from "react"

export type MarketItem = {
  id: string   // indexTokenAddress
  name: string // e.g. "BTC/USD"
}

type Props = {
  markets: MarketItem[]
  activeMarketId?: string
  onSelect: (marketId: string) => void
}

export function MarketSelector({ markets, activeMarketId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const activeMarket = markets.find((m) => m.id === activeMarketId)

  const filtered =
    query.trim() === ""
      ? markets
      : markets.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))

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
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-semibold transition-colors hover:bg-accent"
      >
        {activeMarket?.name ?? "Select Market"}
        <svg
          aria-hidden
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
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              aria-label="Search markets"
              placeholder="Search markets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                <button
                  key={market.id}
                  onClick={() => {
                    onSelect(market.id)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={`flex w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    market.id === activeMarketId ? "bg-accent/60 font-medium" : ""
                  }`}
                >
                  {market.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
