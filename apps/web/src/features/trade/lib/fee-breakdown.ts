import { DOCS_URL } from "@/shared/lib/site-identity"

export const TRADE_FEE_DOCS = {
  overview: {
    label: "Funding & fees docs",
    href: `${DOCS_URL}/concepts/funding-and-fees`,
  },
  positionFee: {
    label: "Position fees",
    href: `${DOCS_URL}/concepts/funding-and-fees#position-fee`,
  },
  priceImpact: {
    label: "Price impact",
    href: `${DOCS_URL}/concepts/funding-and-fees#price-impact`,
  },
  funding: {
    label: "Funding rates",
    href: `${DOCS_URL}/concepts/funding-and-fees#funding`,
  },
  executionCost: {
    label: "Execution cost",
    href: `${DOCS_URL}/concepts/funding-and-fees#network-execution-fee`,
  },
  liquidation: {
    label: "Liquidation & margin",
    href: `${DOCS_URL}/concepts/liquidation`,
  },
} as const

/**
 * Format a USD fee/cost amount without silently truncating sub-cent precision
 * (e.g. $0.051 stays "$0.051", $0.0004 stays "$0.0004", $12.34 stays "$12.34").
 */
export function formatPreciseUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "Unavailable"
  const normalized = Object.is(amount, -0) ? 0 : amount
  if (normalized === 0) return "$0.00"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(normalized)
}

/**
 * Format an XLM execution fee while preserving up to 7 Stellar stroop decimals.
 */
export function formatPreciseXlm(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "Unavailable"
  const normalized = Object.is(amount, -0) ? 0 : amount
  return `~${normalized.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })} XLM`
}

/**
 * Format a percentage while preserving sub-basis-point precision when present.
 */
export function formatPrecisePct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "Unavailable"
  const normalized = Object.is(pct, -0) ? 0 : pct
  if (normalized === 0) return "0.00%"

  const abs = Math.abs(normalized)
  const hasExtra = Math.abs(abs - Number(abs.toFixed(2))) >= 1e-6
  const decimals = abs < 0.01 ? 4 : hasExtra ? 4 : 2
  const sign = normalized > 0 ? "+" : ""
  return `${sign}${normalized.toFixed(decimals)}%`
}

export function formatFeeRateBps(bps: number | null | undefined): string | null {
  if (bps == null || !Number.isFinite(bps)) return null
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Estimate the funding cost for one 8-hour settlement epoch on `sizeUsd`.
 */
export function estimateFundingCost8h(
  sizeUsd: number,
  ratePerHour: number | null | undefined,
): number | null {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return null
  if (ratePerHour == null || !Number.isFinite(ratePerHour)) return null
  return sizeUsd * ratePerHour * 8
}

export type FeeAvailabilityState =
  | "loading"
  | "empty"
  | "stale"
  | "insufficient"
  | "unavailable"
  | "estimated"

export function describeFeeAvailability(params: {
  isLoading: boolean
  sizeUsd: number
  status: "estimated" | "unknown" | "stale" | "insufficient"
}): { state: FeeAvailabilityState; message: string } {
  if (params.isLoading) {
    return {
      state: "loading",
      message: "Loading verified fee configuration…",
    }
  }
  if (!Number.isFinite(params.sizeUsd) || params.sizeUsd <= 0) {
    return {
      state: "empty",
      message: "Enter a trade amount to preview fees, price impact, and execution cost.",
    }
  }
  if (params.status === "stale") {
    return {
      state: "stale",
      message: "Fee or depth data is stale — refresh required before relying on estimates.",
    }
  }
  if (params.status === "insufficient") {
    return {
      state: "insufficient",
      message: "Insufficient order-book depth to estimate price impact for this size.",
    }
  }
  if (params.status === "unknown") {
    return {
      state: "unavailable",
      message: "Verified fee schedule or executable depth is currently unavailable.",
    }
  }
  return {
    state: "estimated",
    message: "Estimated from verified fee config and live reference inputs.",
  }
}
