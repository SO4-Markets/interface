import { formatUsd } from "@/shared/lib/format"

type Props = {
  marketName?: string | null
  volume24h?: number | null
  openInterest?: number | null
  markPrice?: number | null
  indexPrice?: number | null
  fundingRate?: number | null
}

export function MarketStatsHeader({
  volume24h,
  openInterest,
  markPrice,
  indexPrice,
  fundingRate,
}: Props) {
  const stats = [
    ["24h volume · venue", formatUsd(volume24h, { compact: true }), "Executed venue volume; unavailable until sourced"],
    ["Open interest · verified", formatUsd(openInterest, { compact: true }), "Aggregated perpetuals open interest"],
    ["Funding · verified", fundingRate == null ? "—" : `${fundingRate.toFixed(4)}%`, "Perpetual funding rate per hour"],
    ["Mark price · reference", formatUsd(markPrice), "Reference price used for risk and liquidation"],
    ["Oracle price · reference", formatUsd(indexPrice), "Oracle/reference price; not an execution quote"],
  ]

  return (
    <dl className="grid min-w-max grid-cols-5 gap-4 px-3 py-2">
      {stats.map(([label, value, description]) => (
        <div key={label} className="min-w-28">
          <dt className="text-xs text-muted-foreground" title={description}>{label}</dt>
          <dd className="font-mono text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
