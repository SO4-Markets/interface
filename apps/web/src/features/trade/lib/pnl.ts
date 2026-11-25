import { formatPct, formatUsd } from "@/shared/lib/format"

const FALLBACK = "—"

function isBad(n: number | undefined | null): boolean {
  return n == null || !isFinite(n)
}

/**
 * Format a PnL value with a leading sign prefix.
 *
 * @example formatPnl(500)        // "+$500.00"
 * @example formatPnl(-250.5)     // "-$250.50"
 * @example formatPnl(0)          // "+$0.00"
 * @example formatPnl(undefined)  // "—"
 */
export function formatPnl(pnlUsd: number | undefined | null): string {
  if (isBad(pnlUsd)) return FALLBACK
  const sign = pnlUsd! >= 0 ? "+" : ""
  return `${sign}${formatUsd(pnlUsd)}`
}

/**
 * Format a PnL percentage with a leading sign prefix.
 *
 * @example formatPnlPercent(12.5)       // "+12.50%"
 * @example formatPnlPercent(-3.75)      // "-3.75%"
 * @example formatPnlPercent(0)          // "+0.00%"
 * @example formatPnlPercent(NaN)        // "—"
 */
export function formatPnlPercent(pct: number | undefined | null): string {
  return formatPct(pct, { decimals: 2, sign: true })
}
