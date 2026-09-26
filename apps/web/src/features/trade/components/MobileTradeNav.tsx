import { cn } from "@workspace/ui/lib/utils"

// Issue 684 (OB-037): mobile chart, book, and trade navigation.
//
// A bottom tab bar that switches which trading-layout region is visible
// on narrow viewports. Panels stay mounted (the caller toggles visibility
// with CSS, not conditional rendering) so switching tabs never loses an
// in-progress order draft or input focus, and safe-area padding keeps the
// bar clear of home-indicator gestures.

export const MOBILE_TRADE_VIEWS = ["chart", "book", "trade", "positions"] as const
export type MobileTradeView = (typeof MOBILE_TRADE_VIEWS)[number]

const VIEW_LABELS: Record<MobileTradeView, string> = {
  chart: "Chart",
  book: "Book",
  trade: "Trade",
  positions: "Positions",
}

type MobileTradeNavProps = {
  active: MobileTradeView
  onChange: (view: MobileTradeView) => void
  className?: string
}

export function MobileTradeNav({ active, onChange, className }: MobileTradeNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="Trading panels"
      className={cn(
        "flex shrink-0 border-t border-border bg-background",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      {MOBILE_TRADE_VIEWS.map((view) => {
        const isActive = view === active
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`mobile-trade-view-${view}`}
            onClick={() => onChange(view)}
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors motion-reduce:transition-none",
              isActive
                ? "text-foreground border-t-2 border-primary -mt-px"
                : "text-muted-foreground"
            )}
          >
            {VIEW_LABELS[view]}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * Toggle visibility with CSS rather than unmounting — keeps form state,
 * scroll position, and focus intact when the user switches tabs and comes
 * back, and avoids re-running any panel mount animation on every switch.
 *
 * Mobile (< md): single active view only
 * Tablet (md - lg): chart + book visible, trade/positions in tabs
 * Desktop (>= lg): all regions shown side by side
 */
export function mobileViewClassName(view: MobileTradeView, active: MobileTradeView): string {
  // Show chart and book at all times on tablet/desktop, use tabs for others
  if (view === "chart" || view === "book") {
    return "flex md:flex"
  }
  // Trade and positions tabs: active on mobile, otherwise hidden until lg
  return view === active ? "flex md:hidden lg:flex" : "hidden md:hidden lg:flex"
}
