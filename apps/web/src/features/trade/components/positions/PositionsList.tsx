import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Numeric } from "@workspace/ui/components/numeric"
import { activeQueryNetwork, queryKeys } from "../../lib/query-keys"
import { usePositionsWithIndexer } from "../../hooks/usePositionsWithIndexer"
import { useFundingRate } from "../../hooks/useFundingRate"
import { claimFundingFees } from "../../lib/stellar"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { usePositionActions } from "../../hooks/usePositionActions"
import {
  RISK_SOURCE_LABEL,
  describePositionRisk,
  riskSeverity,
} from "../../lib/position-risk"
import { AccountOrderCard } from "./AccountRowDetails"
import { CollateralDialog } from "./CollateralDialog"
import { ClosePositionDialog } from "./ClosePositionDialog"
import type { Position } from "../../hooks/usePositions"
import type { Column } from "@workspace/ui/components/data-table"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

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
  const { data: positions = [], isLoading, isDisabled } = usePositionsWithIndexer()
  const { data: fundingRate } = useFundingRate()
  const { getStaleness } = useTokenPrices()
  const countdown = useFundingCountdown((fundingRate as any)?.nextEpochTs)
  const account = useWalletStore((state) => state.address)
  const queryClient = useQueryClient()
  const { submitClose, submitCollateral, isBusy } = usePositionActions()
  const [closing, setClosing] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [dialogPosition, setDialogPosition] = useState<Position | null>(null)
  const [closeDialogPosition, setCloseDialogPosition] = useState<Position | null>(null)
  const [dialogMode, setDialogMode] = useState<"add" | "remove" | null>(null)

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
      await claimFundingFees(position.account, [position.marketAddress], [position.collateralToken])
      if (account) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.positions(activeQueryNetwork(), account),
        })
      }
    } finally {
      setClaiming(null)
    }
  }

  const columns: Array<Column<Position>> = [
    {
      id: "market",
      header: "Market",
      sticky: true,
      accessor: (p) => (
        <div className="flex items-center gap-1.5">
          <TokenIcon symbol={p.indexToken} size={20} />
          <span className="font-medium">{p.marketName}</span>
          <StatusBadge variant={p.isLong ? "success" : "danger"}>
            <span aria-hidden="true">{p.isLong ? "↗" : "↘"}</span>
            <span>{p.isLong ? "Long" : "Short"}</span>
          </StatusBadge>
        </div>
      ),
    },
    {
      id: "size",
      header: "Size",
      accessor: (p) => <Numeric value={p.sizeUsd} format="usd" role="neutral" />,
    },
    {
      id: "collateral",
      header: "Collateral",
      accessor: (p) => <Numeric value={p.collateralUsd} format="usd" role="neutral" />,
    },
    {
      id: "entry",
      header: "Entry",
      accessor: (p) => <Numeric value={p.entryPrice} format="usd" role="neutral" />,
    },
    {
      id: "mark",
      header: "Mark",
      accessor: (p) => <Numeric value={p.markPrice} format="usd" role="neutral" rolling />,
    },
    {
      id: "liq",
      header: "Liq.",
      accessor: (p) => {
        const closeToLiq = Math.abs(p.markPrice - p.liquidationPrice) / p.markPrice <= 0.1
        return <Numeric value={p.liquidationPrice} format="usd" role={closeToLiq ? "danger" : "neutral"} />
      },
    },
    {
      id: "risk",
      header: "Available risk",
      accessor: (p) => {
        const reading = describePositionRisk({
          sizeUsd: p.sizeUsd,
          markPriceUsd: p.markPrice,
          liquidationPriceUsd: p.liquidationPrice,
          isLong: p.isLong,
          markPriceStaleness: getStaleness(p.indexToken),
        })

        if (!reading.hasData) {
          return <StatusBadge variant="muted">No data</StatusBadge>
        }

        return (
          <div className="flex flex-col items-start gap-0.5">
            <Numeric
              value={reading.availableRiskUsd}
              format="usd"
              role={riskSeverity(reading)}
            />
            <span className="text-10 text-muted-foreground">
              {reading.isStale ? "Stale oracle" : RISK_SOURCE_LABEL[reading.source]} Est.
            </span>
          </div>
        )
      },
    },
    {
      id: "pnl",
      header: "PnL",
      accessor: (p) => {
        const role = p.pnlAfterFees >= 0 ? "positive" : "negative"
        const direction = p.pnlAfterFees >= 0 ? "gain" : "loss"
        const symbol = p.pnlAfterFees >= 0 ? "▲" : "▼"
        return (
          <span className="inline-flex items-center gap-1" aria-label={`PnL ${direction}`}>
            <span aria-hidden="true" className="font-semibold">{symbol}</span>
            <Numeric value={p.pnlAfterFees} format="usd" role={role} rolling />
            {" "}
            <Numeric value={p.pnlPercent} format="pct" role={role} rolling />
          </span>
        )
      },
    },
    {
      id: "funding-fee",
      header: "Funding Fee",
      accessor: (p) =>
        p.fundingFeeUsd > 0 ? (
          <Numeric value={p.fundingFeeUsd} format="usd" role="positive" />
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      id: "next-funding",
      header: "Next Funding",
      accessor: () => (
        <span className="font-mono tabular-nums text-muted-foreground">{countdown}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      accessor: (p) => (
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
          {p.fundingFeeUsd > 0 && (
            <Button
              size="xs"
              variant="outline"
              disabled={claiming === p.key}
              onClick={(e) => {
                e.stopPropagation()
                void handleClaim(p)
              }}
            >
              {claiming === p.key ? "\u2026" : "Claim"}
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            pending={closing === p.key || isBusy(p.key)}
            onClick={(e) => {
              e.stopPropagation()
              setCloseDialogPosition(p)
            }}
          >
            {closing === p.key ? "\u2026" : "Close"}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {isDisabled && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500">
          ⚠️ Indexer disabled - Historical data unavailable. Showing live contract data only.
        </div>
      )}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={positions}
          ariaLabel="Open positions"
          animateRows
          isLoading={isLoading}
          emptyMessage="No open positions"
          emptyAction={
            <div className="flex flex-col items-center gap-2">
              {isDisabled && (
                <p className="text-xs text-amber-500">
                  ⚠️ Indexer disabled - showing contract-only data
                </p>
              )}
              <p className="text-xs text-muted-foreground">Start trading to open your first position</p>
              <a href="/trade" className="text-xs text-primary hover:text-primary/80 font-medium">
                Start trading →
              </a>
            </div>
          }
          keyExtractor={(p) => p.key}
          onRowClick={onSelectPosition ? (p) => onSelectPosition(p) : undefined}
        />
      </div>
      <div className="space-y-2 p-3 md:hidden" role="list" aria-label="Open positions">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading positions…</p>
        ) : positions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No open positions</p>
        ) : positions.map((p) => {
          const reading = describePositionRisk({
            sizeUsd: p.sizeUsd,
            markPriceUsd: p.markPrice,
            liquidationPriceUsd: p.liquidationPrice,
            isLong: p.isLong,
            markPriceStaleness: getStaleness(p.indexToken),
          })
          return (
            <div key={p.key} role="listitem">
              <AccountOrderCard
                rowKey={p.key}
                marketName={p.marketName}
                sideBadge={{ label: p.isLong ? "Long" : "Short", variant: p.isLong ? "success" : "danger" }}
                summarySizeUsd={p.sizeUsd}
                fields={[
                  { label: "Collateral", value: <Numeric value={p.collateralUsd} format="usd" /> },
                  { label: "Entry", value: <Numeric value={p.entryPrice} format="usd" /> },
                  { label: "Mark", value: <Numeric value={p.markPrice} format="usd" /> },
                  { label: "Liq.", value: <Numeric value={p.liquidationPrice} format="usd" /> },
                  { label: "Available risk", value: reading.hasData ? <Numeric value={reading.availableRiskUsd} format="usd" role={riskSeverity(reading)} /> : <span>No data</span> },
                  { label: "PnL", value: <span aria-label={`PnL ${p.pnlAfterFees >= 0 ? "gain" : "loss"}`}><Numeric value={p.pnlAfterFees} format="usd" role={p.pnlAfterFees >= 0 ? "positive" : "negative"} /> <Numeric value={p.pnlPercent} format="pct" role={p.pnlAfterFees >= 0 ? "positive" : "negative"} /></span> },
                  { label: "Funding fee", value: p.fundingFeeUsd > 0 ? <Numeric value={p.fundingFeeUsd} format="usd" role="positive" /> : <span>&mdash;</span> },
                  { label: "Next funding", value: <span className="font-mono tabular-nums">{countdown}</span> },
                ]}
                actions={[
                  { label: "Share", onClick: () => handleShare(p) },
                  { label: "+ Collateral", onClick: () => { setDialogPosition(p); setDialogMode("add") } },
                  { label: "- Collateral", onClick: () => { setDialogPosition(p); setDialogMode("remove") } },
                  ...(p.fundingFeeUsd > 0 ? [{ label: "Claim", pending: claiming === p.key, onClick: () => void handleClaim(p) }] : []),
                  { label: "Close", pending: closing === p.key || isBusy(p.key), onClick: () => setCloseDialogPosition(p) },
                ]}
              />
            </div>
          )
        })}
      </div>
      <CollateralDialog
        position={dialogPosition}
        mode={dialogMode}
        open={dialogPosition !== null}
        onClose={() => {
          setDialogPosition(null)
          setDialogMode(null)
        }}
        onSubmit={async (amount) => {
          if (!dialogPosition || !dialogMode) return null
          const hash = await submitCollateral(dialogPosition, {
            mode: dialogMode,
            amount,
          })
          if (hash) {
            setDialogPosition(null)
            setDialogMode(null)
          }
          return hash
        }}
      />
      <ClosePositionDialog
        position={closeDialogPosition}
        open={closeDialogPosition !== null}
        onClose={() => setCloseDialogPosition(null)}
        onConfirm={async (payload) => {
          if (!closeDialogPosition) return
          setClosing(closeDialogPosition.key)
          try {
            await submitClose(closeDialogPosition, payload)
          } finally {
            setClosing(null)
            setCloseDialogPosition(null)
          }
        }}
      />
    </>
  )
}

