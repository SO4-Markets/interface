// Formatting only — covered by formatters.test.ts against representative
// magnitudes; routes through shared formatters in shared/lib/format.ts.

import { formatCompact, formatPct, formatUsd } from "@/shared/lib/format"

/** 230000 -> "230K", 5_200_000 -> "5.2M", 1_400_000_000 -> "1.4B" */
export function shortFormat(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${trimZero(value / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`
  if (abs >= 1_000) return `${trimZero(value / 1_000)}K`
  return String(Math.round(value))
}

/** 230000 -> "$230K" */
export function shortFormatUsd(value: number): string {
  return `$${shortFormat(value)}`
}

/** 157000000 -> "$157 000 000" (space-grouped thousands, GMX's liquidity total style) */
export function cleanFormatUsd(value: number): string {
  const rounded = Math.round(value)
  return `$${rounded.toLocaleString("en-US").replace(/,/g, " ")}`
}

/** 0.1465 -> "14.65%" */
export function percentFormat(value: number): string {
  return formatPct(value * 100, { decimals: 2, sign: false })
}

function trimZero(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}
