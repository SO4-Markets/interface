import { useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {  usePositions } from "../../hooks/usePositions"
import { createDecreaseOrder } from "../../lib/stellar"
import type {Position} from "../../hooks/usePositions";
import { formatPct, formatUsd } from "@/shared/lib/format"

type Props = {
  onSelectPosition?: (position: Position) => void
}

export function PositionsList({ onSelectPosition }: Props) {
  const { data: positions = [], isLoading } = usePositions()
  const [closing, setClosing] = useState<string | null>(null)

  async function handleClose(position: Position) {
    setClosing(position.key)
    try {
      // TODO: Open PositionSeller sheet/dialog instead of instant close
      //   so the user can choose receive token and acceptable price
      await createDecreaseOrder({
        account: position.account,
        positionKey: position.key,
        marketAddress: position.marketAddress,
        collateralToken: position.collateralToken,
        collateralDeltaAmount: position.collateralAmount,
        sizeDeltaUsd: position.sizeUsd,   // full close
        isLong: position.isLong,
        acceptablePrice: position.markPrice,
        orderType: "MarketDecrease",
        receiveToken: position.collateralToken,
      })
    } finally {
      setClosing(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No open positions
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2">Market</th>
            <th className="px-4 py-2">Size</th>
            <th className="px-4 py-2">Collateral</th>
            <th className="px-4 py-2">Entry</th>
            <th className="px-4 py-2">Mark</th>
            <th className="px-4 py-2">Liq.</th>
            <th className="px-4 py-2">PnL</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={p.key}
              className="cursor-pointer border-b border-border/50 hover:bg-muted/30"
              onClick={() => onSelectPosition?.(p)}
            >
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{p.marketName}</span>
                  <Badge
                    variant="secondary"
                    className={
                      p.isLong ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    }
                  >
                    {p.isLong ? "Long" : "Short"}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-2 font-mono">{formatUsd(p.sizeUsd)}</td>
              <td className="px-4 py-2 font-mono">{formatUsd(p.collateralUsd)}</td>
              <td className="px-4 py-2 font-mono">{formatUsd(p.entryPrice)}</td>
              <td className="px-4 py-2 font-mono">{formatUsd(p.markPrice)}</td>
              <td className="px-4 py-2 font-mono text-amber-500">{formatUsd(p.liquidationPrice)}</td>
              <td className="px-4 py-2 font-mono">
                <span className={p.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                  {p.pnl >= 0 ? "+" : ""}
                  {formatUsd(p.pnl)} ({formatPct(p.pnlPercent)})
                </span>
              </td>
              <td className="px-4 py-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={closing === p.key}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleClose(p)
                  }}
                >
                  {closing === p.key ? "…" : "Close"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
