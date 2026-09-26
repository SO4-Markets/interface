import { useEffect, useMemo, useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { createSwapOrder, sendBatchOrderTxn } from "../../lib/stellar"
import { formatUsd } from "../../lib/trade-math"
import { useTradeFees } from "../../hooks/useTradeFees"
import { getEstimatedEntryPrice, getPriceImpactPct } from "../../lib/pricing"
import {
  toCreateOrderParams,
  toDecreaseOrderParams,
} from "../../lib/order-encoding"
import { fetchFeeConfig } from "../../lib/data-store"
import { activeQueryNetwork, queryKeys } from "../../lib/query-keys"
import type { DecreaseOrderParams, IncreaseOrderParams } from "../../lib/stellar"
import type { useTradeState } from "../../hooks/useTradeState"
import { applyReferralCode } from "@/features/referrals/lib/referrals"
import {
  buildBatchOrderTransaction,
  buildCreateOrderTransaction,
  getTraderReferralCode,
  parseSorobanError,
  readStoredReferralCode,
} from "@/lib/contracts"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { estimateFee } from "@/lib/soroban/simulate"
import { formatAddress } from "@/shared/lib/format"
import { clampLeverage } from "../../lib/risk"
import { getProtectionPrice } from "../../lib/fee-preview"
import { useMarketRiskParams } from "../../hooks/useMarketRiskParams"
import { validateExecutionRequest } from "../../lib/execution-support"

type Props = {
  open: boolean
  onClose: () => void
  tradeState: ReturnType<typeof useTradeState>
  sizeUsd: number
  entryPrice: number
  liquidationPrice: number | null
  totalFeesUsd: number | null
}

export function ConfirmationDialog({
  open,
  onClose,
  tradeState,
  sizeUsd,
  entryPrice,
  liquidationPrice,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [networkFee, setNetworkFee] = useState<string | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [estimatingFee, setEstimatingFee] = useState(false)
  const account = useWalletStore((state: { address: string | null }) => state.address)

  // OB-077: Track input snapshot to detect material changes requiring review
  const inputSnapshotRef = useRef<{
    sizeUsd: number
    entryPrice: number
    leverage: number
    triggerPrice: string
    collateralAmount: string
  } | null>(null)
  const [isStale, setIsStale] = useState(false)

  const {
    tradeFlags,
    toTokenAddress,
    collateralAddress,
    leverage,
    fromAmount,
    triggerPrice,
    sidecarOrders,
    clearSidecarOrders,
  } = tradeState
  const marketRisk = useMarketRiskParams(tradeState.marketAddress)
  const effectiveLeverage = marketRisk.params
    ? clampLeverage(leverage, marketRisk.params.maxLeverage)
    : 0

  const fees = useTradeFees({
    sizeUsd,
    marketAddress: tradeState.marketAddress,
    isIncrease: true,
    tradeType: tradeState.tradeType,
    referencePrice: entryPrice,
  })
  const priceImpactPct = getPriceImpactPct(sizeUsd, fees.priceImpactUsd)
  const estimatedEntryPrice = getEstimatedEntryPrice(
    entryPrice,
    priceImpactPct,
    tradeFlags.isLong
  )
  const acceptablePrice = getProtectionPrice({
    referencePrice: entryPrice,
    isLong: tradeFlags.isLong,
    slippagePct: tradeState.advanced.slippagePct,
  })

  const { data: feeConfig } = useQuery({
    queryKey: queryKeys.trade.feeConfig(
      activeQueryNetwork(),
      tradeState.marketAddress
    ),
    queryFn: () => fetchFeeConfig(tradeState.marketAddress),
    staleTime: 120_000,
    enabled: !!tradeState.marketAddress && open,
  })

  const maxPositionError =
    !tradeFlags.isSwap && feeConfig?.source === "verified" && sizeUsd > feeConfig.maxPositionSizeUsd
      ? `Maximum position size for ${tradeState.toTokenAddress}/USD is $${feeConfig.maxPositionSizeUsd.toLocaleString()}.`
      : null
  const executionValidation = validateExecutionRequest({ attachedOrders: sidecarOrders })

  // OB-077: Detect material input changes that invalidate the preview
  useEffect(() => {
    if (!open) {
      inputSnapshotRef.current = null
      setIsStale(false)
      return
    }

    const currentInputs = {
      sizeUsd,
      entryPrice,
      leverage,
      triggerPrice: triggerPrice ?? "",
      collateralAmount: fromAmount ?? "",
    }

    if (!inputSnapshotRef.current) {
      // First open — capture snapshot
      inputSnapshotRef.current = currentInputs
      setIsStale(false)
    } else {
      // Check for material changes (>1% for prices/size, exact match for others)
      const prev = inputSnapshotRef.current
      const sizeChanged = Math.abs(currentInputs.sizeUsd - prev.sizeUsd) / Math.max(prev.sizeUsd, 1) > 0.01
      const priceChanged = Math.abs(currentInputs.entryPrice - prev.entryPrice) / Math.max(prev.entryPrice, 1) > 0.01
      const leverageChanged = currentInputs.leverage !== prev.leverage
      const triggerChanged = currentInputs.triggerPrice !== prev.triggerPrice
      const collateralChanged = currentInputs.collateralAmount !== prev.collateralAmount

      if (sizeChanged || priceChanged || leverageChanged || triggerChanged || collateralChanged) {
        setIsStale(true)
      }
    }
  }, [open, sizeUsd, entryPrice, leverage, triggerPrice, fromAmount])

  const sidecarCreateOrders = useMemo((): Array<DecreaseOrderParams> => {
    if (!account || sidecarOrders.length === 0) return []
    return sidecarOrders.map((order, index) => ({
      account,
      positionKey: `sidecar-${index}`,
      marketAddress: tradeState.marketAddress,
      collateralToken: collateralAddress!,
      collateralDeltaAmount: Number(fromAmount || "0") * (order.sizePct / 100),
      sizeDeltaUsd: sizeUsd * (order.sizePct / 100),
      isLong: tradeFlags.isLong,
      acceptablePrice: acceptablePrice ?? entryPrice,
      triggerPrice: Number(order.triggerPrice),
      orderType: order.type === "takeProfit" ? "LimitDecrease" : "StopLoss",
      receiveToken: collateralAddress!,
    }))
  }, [
    account,
    sidecarOrders,
    tradeState.marketAddress,
    collateralAddress,
    fromAmount,
    sizeUsd,
    tradeFlags.isLong,
    estimatedEntryPrice,
    acceptablePrice,
    entryPrice,
  ])

  useEffect(() => {
    if (!open || !account || tradeFlags.isSwap) return

    const run = async () => {
      setEstimatingFee(true)
      setEstimateError(null)
      try {
        const parentOrder: IncreaseOrderParams = {
          account,
          marketAddress: tradeState.marketAddress,
          collateralToken: collateralAddress!,
          collateralAmount: Number(fromAmount),
          sizeDeltaUsd: sizeUsd,
          isLong: tradeFlags.isLong,
          acceptablePrice: acceptablePrice ?? entryPrice,
          triggerPrice: tradeFlags.isMarket
            ? undefined
            : Number(triggerPrice) || estimatedEntryPrice || acceptablePrice || entryPrice,
          orderType: tradeFlags.isMarket ? "MarketIncrease" : "LimitIncrease",
          leverage: effectiveLeverage,
        }

        const tx = sidecarCreateOrders.length
          ? await buildBatchOrderTransaction(account, [
              {
                actionType: "createOrder",
                orderParams: toCreateOrderParams(parentOrder),
                cancelKey: null,
              },
              ...sidecarCreateOrders.map((order) => ({
                actionType: "createOrder" as const,
                orderParams: toDecreaseOrderParams(order),
                cancelKey: null,
              })),
            ])
          : await buildCreateOrderTransaction(
              toCreateOrderParams(parentOrder)
            )

        const fee = await estimateFee(tx)
        setNetworkFee(fee.total)
      } catch (error) {
        setEstimateError(parseSorobanError(error))
      } finally {
        setEstimatingFee(false)
      }
    }

    void run()
  }, [
    open,
    account,
    tradeFlags.isSwap,
    tradeState.marketAddress,
    collateralAddress,
    fromAmount,
    sizeUsd,
    tradeFlags.isLong,
    tradeFlags.isMarket,
    triggerPrice,
    effectiveLeverage,
    estimatedEntryPrice,
    acceptablePrice,
    entryPrice,
    sidecarCreateOrders,
  ])

  async function handleConfirm() {
    // OB-077: Prevent rapid double-clicks from creating duplicate orders
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      if (!executionValidation.valid) {
        throw new Error(executionValidation.reason)
      }
      if (tradeFlags.isSwap) {
        await createSwapOrder({
          account: account ?? "GDUMMY...STELLAR",
          fromToken: tradeState.fromTokenAddress,
          toToken: toTokenAddress,
          amountIn: Number(fromAmount),
          minAmountOut: 0,
          swapPath: [],
        })
      } else {
        if (!account) {
          throw new Error("Connect your wallet before placing an order.")
        }
        if (marketRisk.state !== "available" || effectiveLeverage <= 0) {
          throw new Error("Market risk parameters are unavailable or stale.")
        }

        const storedReferralCode = readStoredReferralCode()
        if (storedReferralCode) {
          const existingCode = await getTraderReferralCode(account)
          if (!existingCode) {
            try {
              await applyReferralCode(account, storedReferralCode)
            } catch (error) {
              console.warn("Referral code could not be auto-applied:", error)
            }
          }
        }

        const parentOrder: IncreaseOrderParams = {
          account,
          marketAddress: tradeState.marketAddress,
          collateralToken: collateralAddress!,
          collateralAmount: Number(fromAmount),
          sizeDeltaUsd: sizeUsd,
          isLong: tradeFlags.isLong,
          acceptablePrice: acceptablePrice ?? entryPrice,
          triggerPrice: tradeFlags.isMarket
            ? undefined
            : Number(triggerPrice) || estimatedEntryPrice || acceptablePrice || entryPrice,
          orderType: tradeFlags.isMarket ? "MarketIncrease" : "LimitIncrease",
          leverage: effectiveLeverage,
        }

        await sendBatchOrderTxn(account, {
          createOrders: [parentOrder, ...sidecarCreateOrders],
        })

        clearSidecarOrders()
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const typeLabel = tradeFlags.isSwap
    ? "Swap"
    : tradeFlags.isLong
      ? "Long"
      : "Short"

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),28rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="max-w-full pe-8 [overflow-wrap:anywhere]">
            Confirm {typeLabel} {!tradeFlags.isSwap && formatAddress(toTokenAddress)}
          </DialogTitle>
          {/* OB-077: Display network for clarity */}
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Network: {ENV.NETWORK}
          </p>
        </DialogHeader>

        {/* OB-077: Staleness warning */}
        {isStale && (
          <div role="alert" className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600">
            <p className="font-medium">Inputs changed — review required</p>
            <p className="mt-1 text-amber-600/80">
              Price, size, or execution parameters have changed since this dialog opened.
              Please review the updated values before confirming.
            </p>
          </div>
        )}

        <div className="min-w-0 space-y-1.5 text-sm">
          {!tradeFlags.isSwap && (
            <>
              <Row label="Size" value={formatUsd(sizeUsd)} />
              {maxPositionError && (
                <p className="break-words text-xs text-red-500">{maxPositionError}</p>
              )}
              <Row label="Leverage" value={`${effectiveLeverage}x`} />
              <Row
                label="Entry price"
                value={
                  estimatedEntryPrice !== null && estimatedEntryPrice > 0 ? formatUsd(estimatedEntryPrice) : "Unavailable"
                }
              />
              {!tradeFlags.isMarket && (
                <Row label="Limit trigger" value="Not guaranteed to fill" />
              )}
              <Row
                label="Price impact"
                value={priceImpactPct !== null ? `${priceImpactPct.toFixed(2)}%` : "Unavailable"}
                highlight={priceImpactPct !== null && Math.abs(priceImpactPct) > 0.5}
              />
              <Row
                label="Liquidation estimate"
                value={liquidationPrice !== null && liquidationPrice > 0 ? formatUsd(liquidationPrice) : "Unavailable"}
              />
              <Row
                label="Network fee"
                value={
                  estimatingFee
                      ? "Estimating..."
                      : networkFee
                        ? `~${networkFee} XLM`
                        : "Unavailable"
                }
              />
              <Row
                label="Execution fee estimate"
                value={typeof fees.executionFeeXlm === "number" ? `~${fees.executionFeeXlm.toFixed(2)} XLM` : "Unavailable"}
              />
              {estimateError && (
                <p className="max-h-24 max-w-full overflow-y-auto overflow-x-hidden rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-500 [overflow-wrap:anywhere]">
                  Fee estimation warning: {estimateError}
                </p>
              )}
              {sidecarOrders.length > 0 && (
                <div className="min-w-0 rounded border border-border p-2">
                  <p className="mb-1 text-xs font-medium">
                    TP/SL sidecar orders
                  </p>
                  {sidecarOrders.map((order, i) => (
                    <p
                      key={`${order.type}-${i}`}
                      className="break-words text-xs text-muted-foreground"
                    >
                      {order.type === "takeProfit" ? "TP" : "SL"} at{" "}
                      {order.triggerPrice} ({order.sizePct}%)
                    </p>
                  ))}
                  {!executionValidation.valid && (
                    <p role="alert" className="mt-2 text-xs text-amber-500">
                      {executionValidation.reason}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <Row
            label="Collateral"
            value={`${fromAmount || "0"} ${formatAddress(collateralAddress!)}`}
          />
          <div className="border-t border-border pt-1.5">
            <Row label="Total fees" value={fees.totalFeesUsd !== null ? formatUsd(fees.totalFeesUsd) : "Unavailable"} bold />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              sizeUsd <= 0 ||
              !!maxPositionError ||
              !executionValidation.valid
            }
            className={
              tradeFlags.isLong
                ? "bg-green-600 hover:bg-green-700"
                : tradeFlags.isShort
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
            }
          >
            {isSubmitting
              ? "Submitting..."
              : `Confirm ${typeLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string
  value: string
  bold?: boolean
  highlight?: boolean
}) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 ${bold ? "font-medium" : ""}`}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right ${highlight ? "text-red-500" : ""}`} title={value}>
        {value}
      </span>
    </div>
  )
}
