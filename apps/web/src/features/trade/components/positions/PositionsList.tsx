import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { usePositions } from "../../hooks/usePositions"
import { useFundingRate } from "../../hooks/useFundingRate"
import { createDecreaseOrder, claimFundingFees } from "../../lib/stellar"
import type { Position } from "../../hooks/usePositions"
import { formatPct, formatUsd } from "@/shared/lib/format"
import { queryKeys } from "../../lib/query-keys"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { CollateralDialog } from "./CollateralDialog"

type Props = {
  onSelectPosition?: (position: Position) => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m"
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function useFundingCountdown(nextEpochTs: number | undefined): string {
  const [remaining, setRemaining] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (nextEpochTs === undefined) return

    function tick() {
      setRemaining(Math.max(0, nextEpochTs! - Date.now()))
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [nextEpochTs])

  return formatCountdown(remaining)
}

export function PositionsList({ onSelectPosition }: Props) {
  const { data: positions = [], isLoading } = usePositions()
  const { data: fundingRate } = useFundingRate()
  const countdown = useFundingCountdown((fundingRate as any)?.nextEpochTs)
  const account = useWalletStore((state) => state.address)
  const queryClient = useQueryClient()
  const [closing, setClosing] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [dialogPosition, setDialogPosition] = useState<Position | null>(null)
  const [dialogMode, setDialogMode] = useState<"add" | "remove" | null>(null)

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
        sizeDeltaUsd: position.sizeUsd, // full close
        isLong: position.isLong,
        acceptablePrice: position.markPrice,
        orderType: "MarketDecrease",
        receiveToken: position.collateralToken,
      })
      if (account) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.positions("stellar-mainnet", account),
        })
      }
    } finally {
      setClosing(null)
    }
  }

  function handleShare(position: Position) {
    const url = `${window.location.origin}/trade?market=${encodeURIComponent(position.indexToken)}&type=${position.isLong ? "long" : "short"}`
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Position link copied", { description: url }),
      () => toast.error("Could not copy link to clipboard"),
    )
  }

  async function handleClaim(position: Position) {
    setClaiming(position.key)
    try {
      await claimFundingFees(position.account, [position.marketAddress])
      if (account) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.positions("stellar-mainnet", account),
        })
      }
    } finally {
      setClaiming(null)
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
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="text-sm font-medium text-foreground/80">No open positions</p>
        <p className="text-xs text-muted-foreground">Start trading to open your first position</p>
        <a href="/trade" className="text-xs text-primary hover:text-primary/80 font-medium mt-2">
          Start trading →
        </a>
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
            <th className="px-4 py-2">Funding Fee</th>
            <th className="px-4 py-2">Next Funding</th>
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
              <td className={`px-4 py-2 font-mono ${
                Math.abs(p.markPrice - p.liquidationPrice) / p.markPrice <= 0.1
                  ? "text-red-500 font-bold"
                  : "text-amber-500"
              }`}>
                {formatUsd(p.liquidationPrice)}
              </td>
              <td className="px-4 py-2 font-mono">
                <span className={p.pnlAfterFees >= 0 ? "text-green-500" : "text-red-500"}>
                  {p.pnlAfterFees >= 0 ? "+" : ""}
                  {formatUsd(p.pnlAfterFees)} ({formatPct(p.pnlPercent)})
                </span>
              </td>
              <td className="px-4 py-2 font-mono tabular-nums">
                {p.fundingFeeDebt > 0 ? (
                  <span className="text-green-500">{formatUsd(p.fundingFeeDebt)}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-2 font-mono tabular-nums text-muted-foreground">
                {countdown}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShare(p)
                    }}
                  >
                    Share
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDialogPosition(p)
                      setDialogMode("add")
                    }}
                  >
                    + Collateral
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDialogPosition(p)
                      setDialogMode("remove")
                    }}
                  >
                    - Collateral
                  </Button>
                  {p.fundingFeeDebt > 0 && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={claiming === p.key}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleClaim(p)
                      }}
                    >
                      {claiming === p.key ? "…" : "Claim"}
                    </Button>
                  )}
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CollateralDialog
        position={dialogPosition}
        mode={dialogMode}
        open={dialogPosition !== null}
        onClose={() => {
          setDialogPosition(null)
          setDialogMode(null)
        }}
      />
    </div>
  )
}

