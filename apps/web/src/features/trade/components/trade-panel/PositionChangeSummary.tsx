import { estimateLiquidationPrice } from "../../lib/liquidation"
import type { Position } from "../../hooks/usePositions"
import { formatSorobanAmount, toSorobanAmount } from "@/shared/lib/bignum"

type Props = {
  existing: Pick<Position, "sizeUsd" | "sizeInUsdRaw" | "collateralUsd" | "entryPrice" | "liquidationPrice" | "pnl"> | null
  size: number
  collateral: number
  fill: number | null
  mark: number
  long: boolean
  maintenance: number | null
}

export function projectIncrease({ existing, size, collateral, fill, mark, long, maintenance }: Props) {
  const total = (existing?.sizeUsd ?? 0) + size
  const margin = (existing?.collateralUsd ?? 0) + collateral
  const tokens = fill && fill > 0 && (!existing || existing.entryPrice > 0)
    ? (existing ? existing.sizeUsd / existing.entryPrice : 0) + size / fill : null
  const entry = tokens && tokens > 0 ? total / tokens : null
  const pnl = fill && fill > 0 && mark > 0
    ? (existing?.pnl ?? 0) + (long ? 1 : -1) * (mark - fill) * size / fill : null
  return {
    size: formatSorobanAmount((existing?.sizeInUsdRaw ?? 0n) + toSorobanAmount(size, 30), 30),
    entry, leverage: margin > 0 ? total / margin : null, pnl,
    liquidation: entry && maintenance !== null && margin > 0
      ? estimateLiquidationPrice({ entryPrice: entry, collateralUsd: margin, sizeUsd: total, isLong: long, maintenanceMarginRateBps: maintenance }) : null,
  }
}

export function PositionChangeSummary(props: Props) {
  const before = props.existing
  const after = projectIncrease(props)
  function display(value: number | null | undefined) {
    return value != null && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumSignificantDigits: 15 }) : "—"
  }
  const rows = [
    ["Size (USD)", before ? formatSorobanAmount(before.sizeInUsdRaw, 30) : "0", after.size],
    ["Entry (USD)", display(before?.entryPrice), display(after.entry)],
    ["Leverage (×)", display(before && before.collateralUsd > 0 ? before.sizeUsd / before.collateralUsd : null), display(after.leverage)],
    ["Liquidation (USD)", display(before?.liquidationPrice), display(after.liquidation)],
    ["Estimated PnL before fees (USD)", display(before?.pnl ?? 0), display(after.pnl)],
  ]
  return <table className="w-full text-start text-xs tabular-nums">
    <caption>Estimated position changes</caption>
    <thead><tr><th scope="col">Metric</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
    <tbody>{rows.map(([label, prior, next]) => <tr key={label}><th scope="row">{label}</th><td>{prior}</td><td className={prior !== next ? "font-semibold" : undefined}>{next}</td></tr>)}</tbody>
  </table>
}
