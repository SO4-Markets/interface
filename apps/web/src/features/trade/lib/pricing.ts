export function getPriceImpactPct(sizeUsd: number, priceImpactUsd: number | null): number | null {
  if (sizeUsd <= 0 || priceImpactUsd === null) return null
  return (priceImpactUsd / sizeUsd) * 100
}

export function getEstimatedEntryPrice(
  entryPrice: number,
  priceImpactPct: number | null,
  isLong: boolean,
): number | null {
  if (entryPrice <= 0 || priceImpactPct === null) return null
  const magnitude = Math.abs(priceImpactPct) / 100
  return isLong ? entryPrice * (1 + magnitude) : entryPrice * (1 - magnitude)
}
