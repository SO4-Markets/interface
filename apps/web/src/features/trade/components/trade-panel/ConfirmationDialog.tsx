import { useEffect, useMemo, useState } from "react"
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
import { queryKeys } from "../../lib/query-keys"
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

type Props = {
  open: boolean
  onClose: () => void
  tradeState: ReturnType<typeof useTradeState>
  sizeUsd: number
  entryPrice: number
  liquidationPrice: number
  totalFeesUsd: number
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

  const fees = useTradeFees({
    sizeUsd,
    marketAddress: tradeState.marketAddress,
    isIncrease: true,
    tradeType: tradeState.tradeType,
  })
  const priceImpactPct = getPriceImpactPct(sizeUsd, fees.priceImpactUsd)
  const estimatedEntryPrice = getEstimatedEntryPrice(
    entryPrice,
    priceImpactPct,
    tradeFlags.isLong
  )
  const slippageFactor = tradeState.advanced.slippagePct / 100
  const acceptablePrice = tradeFlags.isLong
    ? entryPrice * (1 + slippageFactor)
    : entryPrice * (1 - slippageFactor)

  const { data: feeConfig } = useQuery({
    queryKey: queryKeys.trade.feeConfig(
      "stellar-mainnet",
      tradeState.marketAddress
    ),
    queryFn: () => fetchFeeConfig(tradeState.marketAddress),
    staleTime: 120_000,
    enabled: !!tradeState.marketAddress && open,
  })

  const maxPositionError =
    !tradeFlags.isSwap && feeConfig && sizeUsd > feeConfig.maxPositionSizeUsd
      ? `Maximum position size for ${tradeState.toTokenAddress}/USD is $${feeConfig.maxPositionSizeUsd.toLocaleString()}.`
      : null

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
      acceptablePrice: estimatedEntryPrice,
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
          acceptablePrice,
          triggerPrice: tradeFlags.isMarket
            ? undefined
            : Number(triggerPrice) || estimatedEntryPrice,
          orderType: tradeFlags.isMarket ? "MarketIncrease" : "LimitIncrease",
          leverage,
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
    leverage,
    estimatedEntryPrice,
    sidecarCreateOrders,
  ])

  async function handleConfirm() {
    setIsSubmitting(true)
    try {
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
          acceptablePrice,
          triggerPrice: tradeFlags.isMarket
            ? undefined
            : Number(triggerPrice) || estimatedEntryPrice,
          orderType: tradeFlags.isMarket ? "MarketIncrease" : "LimitIncrease",
          leverage,
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
          <DialogTitle className="max-w-full pr-8 [overflow-wrap:anywhere]">
            Confirm {typeLabel} {!tradeFlags.isSwap && formatAddress(toTokenAddress)}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-1.5 text-sm">
          {!tradeFlags.isSwap && (
            <>
              <Row label="Size" value={formatUsd(sizeUsd)} />
              {maxPositionError && (
                <p className="break-words text-xs text-red-500">{maxPositionError}</p>
              )}
              <Row label="Leverage" value={`${leverage}x`} />
              <Row
                label="Entry price"
                value={
                  estimatedEntryPrice > 0 ? formatUsd(estimatedEntryPrice) : "-"
                }
              />
              <Row
                label="Price impact"
                value={`${priceImpactPct.toFixed(2)}%`}
                highlight={Math.abs(priceImpactPct) > 0.5}
              />
              <Row
                label="Liq. price"
                value={liquidationPrice > 0 ? formatUsd(liquidationPrice) : "-"}
              />
              <Row
                label="Network fee"
                value={
                  estimatingFee
                    ? "Estimating..."
                    : networkFee
                      ? `~${networkFee} XLM`
                      : "-"
                }
              />
              <Row label="Execution fee" value="~0.01 XLM" />
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
                </div>
              )}
            </>
          )}
          <Row
            label="Collateral"
            value={`${fromAmount || "0"} ${formatAddress(collateralAddress!)}`}
          />
          <div className="border-t border-border pt-1.5">
            <Row label="Total fees" value={formatUsd(fees.totalFeesUsd)} bold />
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
              !!maxPositionError
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
