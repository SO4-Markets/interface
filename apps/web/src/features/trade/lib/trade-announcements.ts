/**
 * Screen-reader announcements for trading events (issue 956).
 *
 * Order fills and liquidation proximity both change the trader's risk without
 * moving focus, so a sighted trader notices the row update while a screen
 * reader user hears nothing. These helpers decide *what* to say and *when*;
 * the components route the text through the shared `LiveRegion` primitive.
 */
import { describePositionRisk, riskSeverity } from "./position-risk"
import type { OrderEventType } from "./order-event-decoder"

/** Polite announcement for an account order event, or null when silent. */
export function orderEventAnnouncement(name: OrderEventType): string | null {
  if (name === "OrderExecuted") return "Order filled. Positions and balances are updating."
  return null
}

/**
 * A warned position must recover past this distance before it can warn again,
 * so a price oscillating around the 5% danger threshold does not repeat the
 * same interruption on every tick.
 */
export const LIQUIDATION_WARNING_CLEAR_PCT = 7.5

export type LiquidationWatchPosition = {
  key: string
  marketName: string
  isLong: boolean
  sizeUsd: number
  markPrice: number
  liquidationPrice: number
}

export type LiquidationWarningResult = {
  /** Keys currently in the warned state; feed back in on the next update. */
  warned: Set<string>
  /** One sentence per position that newly crossed into danger. */
  messages: Array<string>
}

function formatDistance(pct: number): string {
  return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`
}

/**
 * Compares the latest positions against the set already warned about and
 * returns warnings only for positions that *entered* the danger band (the
 * same ≤5% band that paints the risk cell red). Closed positions drop out of
 * the set, and recovered ones re-arm after {@link LIQUIDATION_WARNING_CLEAR_PCT}.
 */
export function evaluateLiquidationWarnings(
  positions: ReadonlyArray<LiquidationWatchPosition>,
  previouslyWarned: ReadonlySet<string>,
): LiquidationWarningResult {
  const warned = new Set<string>()
  const messages: Array<string> = []

  for (const position of positions) {
    const reading = describePositionRisk({
      sizeUsd: position.sizeUsd,
      markPriceUsd: position.markPrice,
      liquidationPriceUsd: position.liquidationPrice,
      isLong: position.isLong,
      // Staleness only changes the label, not the distance being warned about.
      markPriceStaleness: "fresh",
    })
    if (!reading.hasData) continue

    const wasWarned = previouslyWarned.has(position.key)
    if (riskSeverity(reading) === "danger") {
      warned.add(position.key)
      if (!wasWarned) {
        const side = position.isLong ? "long" : "short"
        messages.push(
          `Liquidation warning: ${position.marketName} ${side} is ${formatDistance(
            reading.liquidationDistancePct,
          )} from its liquidation price.`,
        )
      }
    } else if (wasWarned && reading.liquidationDistancePct < LIQUIDATION_WARNING_CLEAR_PCT) {
      warned.add(position.key)
    }
  }

  return { warned, messages }
}
