export function getPriceImpactPct(sizeUsd: number, priceImpactUsd: number): number {
  if (sizeUsd <= 0) return 0
  return (priceImpactUsd / sizeUsd) * 100
}

export function getEstimatedEntryPrice(
  entryPrice: number,
  priceImpactPct: number,
  isLong: boolean,
): number {
  if (entryPrice <= 0) return 0
  const magnitude = Math.abs(priceImpactPct) / 100
  return isLong ? entryPrice * (1 + magnitude) : entryPrice * (1 - magnitude)
}
