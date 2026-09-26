import { useEffect, useRef, useState } from "react"
import { activeQueryNetwork } from "../../lib/query-keys"

export type MarketItem = {
  id: string      // indexTokenAddress
  name: string    // e.g. "BTC/USD"
  disabled?: boolean
}

const FAVORITES_KEY = "so4-market-favorites-v1"

function loadFavorites(network: string): Array<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${FAVORITES_KEY}:${network}`) ?? "null") as unknown
    const values = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "markets" in parsed ? parsed.markets : []
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []
  } catch {
    return []
  }
}

type Props = {
  markets?: Array<MarketItem>
  activeMarketId?: string
  onSelect: (marketId: string) => void
  network?: string
}

export function MarketSelector({ markets: marketsProp, activeMarketId, onSelect, network = activeQueryNetwork() }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [favorites, setFavorites] = useState<Array<string>>(() => loadFavorites(network))
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = "so4-market-selector-listbox"

  function closeAndRestoreFocus() {
    setOpen(false)
    setQuery("")
    // Escape and outside-click dismiss must return focus to the trigger so
    // keyboard users do not lose their place during live market updates.
    queueMicrotask(() => triggerRef.current?.focus())
  }

  // Use provided markets or an empty array as fallback
  const markets = marketsProp ?? []

  const activeMarket = markets.find((m) => m.id === activeMarketId)
  const availableIds = new Set(markets.map((market) => market.id))
  const enabledMarkets = markets.filter((m) => !m.disabled)
  const validFavorites = favorites.filter((id) => availableIds.has(id))

  useEffect(() => setFavorites(loadFavorites(network)), [network])

  const filtered =
    query.trim() === ""
      ? [...enabledMarkets].sort((a, b) => Number(validFavorites.includes(b.id)) - Number(validFavorites.includes(a.id)))
      : enabledMarkets.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.id.toLowerCase().includes(query.toLowerCase()))

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((value) => value !== id) : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem(`${FAVORITES_KEY}:${network}`, JSON.stringify({ version: 1, markets: next }))
    } catch {
      // Preferences are optional and must never block market selection.
    }
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
        queueMicrotask(() => triggerRef.current?.focus())
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        setQuery("")
        queueMicrotask(() => triggerRef.current?.focus())
      }
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
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
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
        <div
          id={listboxId}
          role="listbox"
          aria-label="Markets"
          className="absolute inset-inline-start-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover shadow-lg"
        >
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
                <div key={market.id} className={`flex items-center rounded ${market.disabled ? "opacity-50" : "hover:bg-accent"}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={market.id === activeMarketId}
                    disabled={market.disabled}
                    onClick={() => {
                      onSelect(market.id)
                      closeAndRestoreFocus()
                    }}
                    className={`min-w-0 flex-1 px-3 py-2 text-start text-sm disabled:cursor-not-allowed ${market.id === activeMarketId ? "font-medium" : ""}`}
                  >
                    {market.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`${validFavorites.includes(market.id) ? "Remove" : "Add"} ${market.name} favorite`}
                    aria-pressed={validFavorites.includes(market.id)}
                    onClick={() => toggleFavorite(market.id)}
                    className="px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    {validFavorites.includes(market.id) ? "★" : "☆"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
