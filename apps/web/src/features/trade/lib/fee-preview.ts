export type PreviewStatus = "estimated" | "unknown" | "stale" | "insufficient"

export type DepthLevel = {
  price: number
  size: number
}

export type VerifiedDepth = {
  source: "verified"
  updatedAt: number
  bids: Array<DepthLevel>
  asks: Array<DepthLevel>
}

export type DepthSnapshot = VerifiedDepth | {
  source: "reference"
  updatedAt: number
  bids: Array<DepthLevel>
  asks: Array<DepthLevel>
}

export type DepthImpact = {
  status: PreviewStatus
  impactPct: number | null
  averagePrice: number | null
  filledNotionalUsd: number
}

export const DEPTH_MAX_AGE_MS = 5_000

/**
 * Calculate adverse price impact from executable venue depth only.
 * Reference books are deliberately not accepted as fillable liquidity.
 */
export function calculateDepthImpact(params: {
  side: "long" | "short"
  orderValueUsd: number
  referencePrice: number
  depth: DepthSnapshot | null | undefined
  now?: number
  maxAgeMs?: number
}): DepthImpact {
  const { side, orderValueUsd, referencePrice, depth } = params
  if (!depth || depth.source !== "verified") {
    return { status: "unknown", impactPct: null, averagePrice: null, filledNotionalUsd: 0 }
  }
  if (!Number.isFinite(depth.updatedAt) || (params.now ?? Date.now()) - depth.updatedAt > (params.maxAgeMs ?? DEPTH_MAX_AGE_MS)) {
    return { status: "stale", impactPct: null, averagePrice: null, filledNotionalUsd: 0 }
  }
  if (!Number.isFinite(orderValueUsd) || orderValueUsd <= 0 || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    return { status: "unknown", impactPct: null, averagePrice: null, filledNotionalUsd: 0 }
  }

  const levels = side === "long" ? depth.asks : depth.bids
  let remaining = orderValueUsd
  let filledNotionalUsd = 0
  let filledTokens = 0

  for (const level of levels) {
    if (!Number.isFinite(level.price) || !Number.isFinite(level.size) || level.price <= 0 || level.size <= 0) continue
    const availableNotionalUsd = level.price * level.size
    const fillNotionalUsd = Math.min(remaining, availableNotionalUsd)
    filledNotionalUsd += fillNotionalUsd
    filledTokens += fillNotionalUsd / level.price
    remaining -= fillNotionalUsd
    if (remaining <= 0) break
  }

  if (remaining > 0 || filledTokens <= 0) {
    return { status: "insufficient", impactPct: null, averagePrice: null, filledNotionalUsd }
  }

  const averagePrice = filledNotionalUsd / filledTokens
  const impactPct = side === "long"
    ? ((averagePrice - referencePrice) / referencePrice) * 100
    : ((referencePrice - averagePrice) / referencePrice) * 100
  return { status: "estimated", impactPct: Math.max(0, impactPct), averagePrice, filledNotionalUsd }
}

export function getProtectionPrice(params: {
  referencePrice: number
  isLong: boolean
  slippagePct: number
}): number | null {
  const { referencePrice, isLong, slippagePct } = params
  if (!Number.isFinite(referencePrice) || referencePrice <= 0 || !Number.isFinite(slippagePct) || slippagePct < 0) return null
  const factor = slippagePct / 100
  return isLong ? referencePrice * (1 + factor) : referencePrice * (1 - factor)
}
