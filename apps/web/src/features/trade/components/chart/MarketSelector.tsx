import { useEffect, useId, useMemo, useRef, useState } from "react"
// Aliased so the DOM globals of the same name stay available for the native
// `document.addEventListener` handlers below.
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { usePriceDelta24h } from "../../hooks/usePriceDelta24h"
import { useMarkets } from "../../hooks/useMarkets"
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react"
import type { Market } from "../../hooks/useMarkets"
import { formatUsd } from "@/shared/lib/format"

type Props = {
  symbol: string | undefined
  onSelect: (indexTokenAddress: string) => void
}

const RECENT_MARKETS_KEY = "so4-recent-markets-v1"
function readRecentMarkets(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_MARKETS_KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch { return [] }
}

function MarketRow({
  market,
  isActive,
  onSelect,
  id,
}: {
  market: Market
  isActive: boolean
  onSelect: () => void
  id: string
}) {
  const { getMidPrice } = useTokenPrices()
  const { data: delta } = usePriceDelta24h(market.indexTokenAddress)
  const price = getMidPrice(market.indexTokenAddress)
  const isPositive = (delta?.deltaPercentage ?? 0) > 0
  const isNegative = (delta?.deltaPercentage ?? 0) < 0

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <li
      id={id}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded px-3 py-2 text-start text-sm transition-colors ${
        isActive ? "bg-accent/60" : "hover:bg-accent"
      }`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => event.preventDefault()}
    >
      <span
        title={market.name}
        className={`truncate font-medium ${isActive ? "text-foreground" : "text-foreground/80"}`}
      >
        {market.name}
      </span>
      <div className="flex items-center gap-3 text-right">
        <span className="font-mono text-xs text-foreground">
          {price > 0 ? formatUsd(price, { decimals: 4 }) : "—"}
        </span>
        <span
          className={`w-16 font-mono text-xs ${
            isPositive
              ? "text-long"
              : isNegative
                ? "text-short"
                : "text-muted-foreground"
          }`}
        >
          {delta?.deltaPercentageStr ?? "—"}
        </span>
      </div>
    </li>
  )
}

export function MarketSelector({ symbol, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentMarkets, setRecentMarkets] = useState<string[]>(() => readRecentMarkets())
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const comboboxId = useId()
  const listboxId = `${comboboxId}-listbox`

  function closeAndRestoreFocus() {
    setOpen(false)
    setSearch("")
    queueMicrotask(() => triggerRef.current?.focus())
  }

  const { markets } = useMarkets()

  const activeMarket = markets.find((m) => m.indexTokenAddress === symbol)

  const filtered = markets.filter((m) =>
    search.trim() === ""
      ? true
      : m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.indexTokenAddress.toLowerCase().includes(search.toLowerCase())
  )
  const recent = useMemo(() => recentMarkets.map((id) => markets.find((m) => m.indexTokenAddress === id)).filter((m): m is Market => Boolean(m)), [markets, recentMarkets])
  const orderedMarkets = useMemo(() => {
    if (search.trim() !== "") return filtered
    const recentIds = new Set(recent.map((market) => market.indexTokenAddress))
    return [...recent, ...filtered.filter((market) => !recentIds.has(market.indexTokenAddress))]
  }, [filtered, recent, search])

  useEffect(() => {
    if (!open) return

    const currentIndex = orderedMarkets.findIndex(
      (m) => m.indexTokenAddress === symbol
    )
    setActiveIndex(Math.max(0, currentIndex))
  }, [open, orderedMarkets, symbol])

  useEffect(() => {
    if (!open) return

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeAndRestoreFocus()
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        closeAndRestoreFocus()
      }
    }

    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const selectMarket = (market: Market) => {
    const nextRecent = [market.indexTokenAddress, ...recentMarkets.filter((id) => id !== market.indexTokenAddress)].slice(0, 5)
    setRecentMarkets(nextRecent)
    try { localStorage.setItem(RECENT_MARKETS_KEY, JSON.stringify(nextRecent)) } catch { /* optional preference */ }
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !prefersReduced
    ) {
      document.startViewTransition(() => {
        onSelect(market.indexTokenAddress)
        closeAndRestoreFocus()
      })
    } else {
      onSelect(market.indexTokenAddress)
      closeAndRestoreFocus()
    }
  }

  const moveActive = (delta: number) => {
    if (orderedMarkets.length === 0) return
    setActiveIndex((current) => {
      const next = current + delta
      return Math.max(0, Math.min(next, orderedMarkets.length - 1))
    })
  }

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      moveActive(1)
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      moveActive(-1)
    }

    if (event.key === "Home") {
      event.preventDefault()
      setActiveIndex(0)
    }

    if (event.key === "End") {
      event.preventDefault()
      setActiveIndex(orderedMarkets.length - 1)
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const market = orderedMarkets.at(activeIndex)
      if (market) selectMarket(market)
    }
  }

  const handleToggle = () => {
    setOpen((value) => {
      const next = !value
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      return next
    })
  }

  const handleClear = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onSelect("")
    setSearch("")
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-2">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 transition-colors duration-fast ease-spring-snappy hover:bg-accent"
      >
        <span
          data-slot="market-name"
          style={{ viewTransitionName: "market-selector-name" }}
          className="text-sm font-semibold text-foreground transition-[transform,opacity] duration-base ease-spring-smooth motion-reduce:transition-none"
        >
          {(activeMarket?.name ?? symbol) || "Select Market"}
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
          className={`text-muted-foreground transition-transform duration-fast ease-spring-snappy motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {symbol && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear selected market"
          className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          ×
        </button>
      )}

      {open && (
        <div className="inset-inline-start-0 absolute top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2">
            <label
              htmlFor={`${comboboxId}-input`}
              className="sr-only"
              id={`${comboboxId}-label`}
            >
              Search markets
            </label>
            <input
              ref={inputRef}
              id={`${comboboxId}-input`}
              role="combobox"
              aria-labelledby={`${comboboxId}-label`}
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={
                orderedMarkets[activeIndex]?.address
                  ? `${comboboxId}-option-${orderedMarkets[activeIndex]?.address}`
                  : undefined
              }
              aria-autocomplete="list"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search markets..."
              className="w-full rounded bg-background px-2.5 py-1.5 text-xs text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-primary"
            />
          </div>
          <ul
            className="max-h-72 overflow-y-auto px-1 pb-1"
            role="listbox"
            id={listboxId}
            aria-labelledby={`${comboboxId}-label`}
          >
            {recent.length > 0 && search.trim() === "" && <li className="px-3 pb-1 pt-2 text-10 font-medium uppercase tracking-wider text-muted-foreground">Recent markets</li>}
            {orderedMarkets.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No markets found
              </li>
            ) : (
              orderedMarkets.map((market, index) => (
                <MarketRow
                  key={market.address}
                  id={`${comboboxId}-option-${market.address}`}
                  market={market}
                  isActive={index === activeIndex}
                  onSelect={() => selectMarket(market)}
                />
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
