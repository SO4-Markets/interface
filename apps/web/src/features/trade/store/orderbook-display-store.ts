import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  DEFAULT_DISPLAY_PREFS,
  
  
  
  groupingOptions,
  isSizeUnit,
  sanitizeDisplayPrefs
} from "../lib/orderbook/display-prefs"
import {  DEFAULT_BOOK_LAYOUT, isBookLayout, toBookLayout } from "../lib/orderbook/layout"
import type {DisplayPrefs, MarketDisplayMetadata, SizeUnit} from "../lib/orderbook/display-prefs";
import type {BookLayout} from "../lib/orderbook/layout";

// OB-052 / OB-053: order book display preferences.
//
// Grouping and size unit are remembered PER MARKET, as a grouping multiplier of
// the market's native tick, so switching between markets with different tick
// sizes keeps each market's own choice. The layout is one global preference.
// Nothing here is market data: no prices, sizes or orders are stored.
//
// Stored values are never trusted. Reads go through `sanitizeDisplayPrefs`
// against the market's current metadata, and hydration drops anything malformed,
// so corrupt or outdated storage degrades to defaults instead of breaking the book.

export const ORDERBOOK_DISPLAY_VERSION = 1
export const ORDERBOOK_DISPLAY_STORAGE_KEY = "orderbook-display"
/** Markets remembered at once; the least recently changed are dropped past this. */
export const MAX_REMEMBERED_MARKETS = 50

type PerMarket = Record<string, DisplayPrefs | undefined>

type PersistedShape = {
  layout: BookLayout
  byMarket: PerMarket
}

export interface OrderBookDisplayState extends PersistedShape {
  setLayout: (layout: BookLayout) => void
  setGrouping: (meta: MarketDisplayMetadata, multiplier: number) => void
  setUnit: (marketId: string, unit: SizeUnit) => void
  /**
   * Call when a market's metadata is known or changes. Replaces stored values
   * that are no longer valid for it; returns which were reset (nothing if none).
   */
  reconcileMarket: (meta: MarketDisplayMetadata) => { grouping: boolean; unit: boolean }
  reset: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Keep only well-formed entries, capped to the newest MAX_REMEMBERED_MARKETS. */
function recoverByMarket(raw: unknown): PerMarket {
  if (!isRecord(raw)) return {}
  const entries: Array<[string, DisplayPrefs]> = []
  for (const [marketId, value] of Object.entries(raw)) {
    if (!marketId || !isRecord(value)) continue
    const { groupingMultiplier, unit } = value
    if (
      typeof groupingMultiplier === "number" &&
      Number.isInteger(groupingMultiplier) &&
      groupingMultiplier > 0 &&
      isSizeUnit(unit)
    ) {
      entries.push([marketId, { groupingMultiplier, unit }])
    }
  }
  // Insertion order is age order (oldest first), so keep the tail.
  return Object.fromEntries(entries.slice(-MAX_REMEMBERED_MARKETS))
}

function recover(persisted: unknown): PersistedShape {
  if (!isRecord(persisted)) return { layout: DEFAULT_BOOK_LAYOUT, byMarket: {} }
  return {
    layout: toBookLayout(persisted.layout),
    byMarket: recoverByMarket(persisted.byMarket),
  }
}

/** Writes `prefs` as the newest entry, evicting the oldest past the cap. */
function withMarket(byMarket: PerMarket, marketId: string, prefs: DisplayPrefs): PerMarket {
  const { [marketId]: _previous, ...rest } = byMarket
  const next = { ...rest, [marketId]: prefs }
  const ids = Object.keys(next)
  if (ids.length <= MAX_REMEMBERED_MARKETS) return next
  return Object.fromEntries(ids.slice(ids.length - MAX_REMEMBERED_MARKETS).map((id) => [id, next[id]!]))
}

export const useOrderBookDisplayStore = create<OrderBookDisplayState>()(
  persist(
    (set, get) => ({
      layout: DEFAULT_BOOK_LAYOUT,
      byMarket: {},

      setLayout: (layout) => {
        // Ignore unknown layouts rather than storing something the UI cannot render.
        if (!isBookLayout(layout)) return
        set({ layout })
      },

      setGrouping: (meta, multiplier) => {
        // Only a grouping this market offers can be chosen.
        if (!groupingOptions(meta).some((option) => option.multiplier === multiplier)) return
        const current = sanitizeDisplayPrefs(get().byMarket[meta.marketId], meta).prefs
        set({ byMarket: withMarket(get().byMarket, meta.marketId, { ...current, groupingMultiplier: multiplier }) })
      },

      setUnit: (marketId, unit) => {
        if (!isSizeUnit(unit)) return
        const stored = get().byMarket[marketId]
        set({
          byMarket: withMarket(get().byMarket, marketId, {
            groupingMultiplier: stored?.groupingMultiplier ?? DEFAULT_DISPLAY_PREFS.groupingMultiplier,
            unit,
          }),
        })
      },

      reconcileMarket: (meta) => {
        const stored = get().byMarket[meta.marketId]
        if (stored === undefined) return { grouping: false, unit: false }
        const { prefs, reset } = sanitizeDisplayPrefs(stored, meta)
        if (reset.grouping || reset.unit) {
          set({ byMarket: { ...get().byMarket, [meta.marketId]: prefs } })
        }
        return reset
      },

      reset: () => set({ layout: DEFAULT_BOOK_LAYOUT, byMarket: {} }),
    }),
    {
      name: ORDERBOOK_DISPLAY_STORAGE_KEY,
      version: ORDERBOOK_DISPLAY_VERSION,
      partialize: (state): PersistedShape => ({ layout: state.layout, byMarket: state.byMarket }),
      merge: (persisted, current) => ({ ...current, ...recover(persisted) }),
    },
  ),
)

/** The preferences to use for a market right now: stored choice, validated against its metadata. */
export function selectDisplayPrefs(state: Pick<OrderBookDisplayState, "byMarket">, meta: MarketDisplayMetadata): DisplayPrefs {
  return sanitizeDisplayPrefs(state.byMarket[meta.marketId], meta).prefs
}
