import { useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Slider } from "@workspace/ui/components/slider"
import { Separator } from "@workspace/ui/components/separator"
import { Badge } from "@workspace/ui/components/badge"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { useTradeFees } from "../../hooks/useTradeFees"
import { useTokenBalances } from "../../../wallet/hooks/useTokenBalances"
import {
  estimateLiquidationPrice,
  formatUsd,
  sizeFromCollateralAndLeverage,
} from "../../lib/trade-math"
import { getToken } from "../../data/tokens"
import { TradeInfoRows } from "./TradeInfoRows"
import { ConfirmationDialog } from "./ConfirmationDialog"
import { ApplyReferralCodePrompt } from "./ApplyReferralCodePrompt"
import type { TradeType, useTradeState } from "../../hooks/useTradeState"
import { NumberInput } from "@/shared/components/NumberInput"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { formatAddress } from "@/shared/lib/format"

type TradeController = ReturnType<typeof useTradeState>

type TradePanelProps = {
  trade: TradeController
}

export function TradePanel({ trade }: TradePanelProps) {
  const { getMidPrice, isStale } = useTokenPrices()
  const { data: balances } = useTokenBalances()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const account = useWalletStore((state) => state.address)

  const {
    tradeType, tradeMode, tradeFlags,
    fromAmount, leverage,
    fromTokenAddress, toTokenAddress, marketAddress, collateralAddress,
    availableTradeModes,
    setTradeType, setTradeMode,
    setLeverage,
    setTriggerPrice,
    advanced,
  } = trade

  const debouncedFromAmount = useDebounce(fromAmount, 300)
  const entryPrice = getMidPrice(toTokenAddress)
  const collateralUsd = parseFloat(debouncedFromAmount || "0") * getMidPrice(collateralAddress!)
  const sizeUsd = tradeFlags.isSwap ? collateralUsd : sizeFromCollateralAndLeverage(collateralUsd, leverage)
  const activeInputTokenAddress = tradeFlags.isSwap ? fromTokenAddress : collateralAddress!

  const fees = useTradeFees({ sizeUsd, marketAddress, isIncrease: true, tradeType })
  const walletBalance = balances?.[activeInputTokenAddress]
  const xlmBalance = balances?.["XLM"] ?? 0
  const collateralAmount = Number(fromAmount || "0")
  const fromTokenLabel = formatTokenLabel(activeInputTokenAddress)
  const toTokenLabel = formatTokenLabel(toTokenAddress)
  const hasCollateralError = walletBalance !== undefined && collateralAmount > walletBalance
  const hasXlmError = xlmBalance < fees.executionFeeXlm
  const validationError = hasCollateralError
    ? `Insufficient ${fromTokenLabel} balance`
    : hasXlmError
      ? `Insufficient XLM balance for execution fees (requires ~${fees.executionFeeXlm.toFixed(2)} XLM)`
      : undefined
  const priceStale = isStale(toTokenAddress)
  const canTrade = collateralAmount > 0 && !validationError && !priceStale

  const liquidationPrice = useMemo(() => {
    if (!tradeFlags.isPosition || sizeUsd <= 0 || entryPrice <= 0) return 0
    return estimateLiquidationPrice({
      entryPrice,
      collateralUsd,
      sizeUsd,
      isLong: tradeFlags.isLong,
    })
  }, [tradeFlags, sizeUsd, entryPrice, collateralUsd])

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      {/* ── Trade type tabs: Long / Short / Swap ───────────────────── */}
      <Tabs value={tradeType} onValueChange={(v) => setTradeType(v as TradeType)}>
        <TabsList className="w-full">
          <TabsTrigger value="Long" className="flex-1 text-green-500 data-[state=active]:text-green-400">
            Long
          </TabsTrigger>
          <TabsTrigger value="Short" className="flex-1 text-red-500 data-[state=active]:text-red-400">
            Short
          </TabsTrigger>
          <TabsTrigger value="Swap" className="flex-1">
            Swap
          </TabsTrigger>
        </TabsList>

        {/* ── Order mode: Market / Limit / Trigger ─────────────────── */}
        <div className="mt-3 flex gap-1">
          {availableTradeModes.map((mode) => (
            <button
              key={mode}
              onClick={() => setTradeMode(mode)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                tradeMode === mode
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <TabsContent value="Long" className="mt-0">
          <TradeInputs trade={trade} validationError={validationError} />
        </TabsContent>
        <TabsContent value="Short" className="mt-0">
          <TradeInputs trade={trade} validationError={validationError} />
        </TabsContent>
        <TabsContent value="Swap" className="mt-0">
          <TradeInputs trade={trade} validationError={validationError} />
        </TabsContent>
      </Tabs>

      {/* ── Trigger price input (Limit / Stop-Loss only) ─────────── */}
      {(tradeMode === "Limit" || tradeMode === "Trigger") && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {tradeMode === "Trigger" ? "Trigger price" : "Limit price"}
          </label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              className="pr-12 font-mono text-sm"
              onChange={(e) => setTriggerPrice(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              USD
            </span>
          </div>
        </div>
      )}

      {/* ── Leverage slider (positions only) ─────────────────────── */}
      {tradeFlags.isPosition && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Leverage</span>
            <Badge variant="secondary">{leverage}×</Badge>
          </div>
          <Slider
            min={1}
            max={50}
            step={0.5}
            value={[leverage]}
            onValueChange={(v) => setLeverage(Array.isArray(v) ? v[0] : v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1×</span>
            <span>50×</span>
          </div>
        </div>
      )}

      {/* ── Size summary ─────────────────────────────────────────── */}
      {tradeFlags.isPosition && sizeUsd > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Position size</span>
          <span className="font-mono font-medium">{formatUsd(sizeUsd)}</span>
        </div>
      )}

      <Separator />

      {/* ── Fee / price info rows ─────────────────────────────────── */}
      <TradeInfoRows
        tradeType={tradeType}
        tradeMode={tradeMode}
        toTokenAddress={toTokenAddress}
        marketAddress={marketAddress}
        leverage={leverage}
        fromAmount={fromAmount}
        sizeUsd={sizeUsd}
      />

      {/* ── Advanced options ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Advanced options</span>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-primary/80"
            onClick={() => trade.setAdvanced({ advancedDisplay: !advanced.advancedDisplay })}
          >
            {advanced.advancedDisplay ? "Hide" : "Show"}
          </button>
        </div>
        {advanced.advancedDisplay && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slippage tolerance</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={advanced.slippagePct}
                  onChange={(e) => trade.setSlippagePct(Number(e.target.value))}
                  className="pr-10 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This sets the maximum allowable slippage for the order. Orders will revert if the fill price exceeds this threshold.
            </p>
          </div>
        )}
      </div>

      {/* ── Submit button ─────────────────────────────────────────── */}
      {priceStale && (
        <p className="text-center text-xs text-muted-foreground">Waiting for price update…</p>
      )}

      <Button
        className={`mt-1 w-full font-medium ${
          tradeFlags.isLong
            ? "bg-green-600 hover:bg-green-700 text-white"
            : tradeFlags.isShort
              ? "bg-red-600 hover:bg-red-700 text-white"
              : ""
        }`}
        disabled={!canTrade}
        onClick={() => setConfirmOpen(true)}
      >
        {tradeType} {!tradeFlags.isSwap && toTokenLabel}
      </Button>

      {/* ── Confirmation modal ───────────────────────────────────── */}
      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tradeState={trade}
        sizeUsd={sizeUsd}
        entryPrice={entryPrice}
        liquidationPrice={liquidationPrice}
        totalFeesUsd={fees.totalFeesUsd}
      />

      <ApplyReferralCodePrompt account={account} />
    </div>
  )
}

// ── Pay / Receive inputs ─────────────────────────────────────────────────────

function TradeInputs({ trade, validationError }: { trade: ReturnType<typeof useTradeState>; validationError?: string }) {
  const { fromAmount, fromTokenAddress, toTokenAddress, collateralAddress, tradeFlags, setFromAmount, switchTokens } = trade
  const { getMidPrice } = useTokenPrices()
  const { data: balances } = useTokenBalances()

  const activeInputTokenAddress = tradeFlags.isSwap ? fromTokenAddress : collateralAddress!
  const fromPrice = getMidPrice(activeInputTokenAddress)
  const fromUsd = parseFloat(fromAmount || "0") * fromPrice
  const walletBalance = balances?.[activeInputTokenAddress]
  const fromTokenLabel = formatTokenLabel(activeInputTokenAddress)
  const toTokenLabel = formatTokenLabel(toTokenAddress)

  return (
    <div className="mt-3 min-w-0 space-y-2">
      {/* Pay */}
      <div className="space-y-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <label className="text-xs text-muted-foreground">
            {tradeFlags.isSwap ? "Pay" : "Collateral"}
          </label>
          {walletBalance !== undefined && (
            <span className="min-w-0 text-right text-xs text-muted-foreground">
              Balance:{" "}
              <span className="font-mono font-medium text-foreground [overflow-wrap:anywhere]">
                {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {fromTokenLabel}
              </span>
            </span>
          )}
        </div>
        <NumberInput
          value={fromAmount}
          onValueChange={setFromAmount}
          placeholder="0.00"
          className="font-mono text-sm"
          onMax={walletBalance !== undefined ? () => setFromAmount(walletBalance.toString()) : undefined}
          usdValue={fromUsd > 0 ? fromUsd : undefined}
        />
        {validationError && (
          <p className="text-xs text-red-500 [overflow-wrap:anywhere]">{validationError}</p>
        )}
      </div>

      {/* Swap arrow */}
      {tradeFlags.isSwap && (
        <button
          onClick={switchTokens}
          className="mx-auto flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
        >
          ↕
        </button>
      )}

      {/* Receive / Index token label */}
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="shrink-0 text-muted-foreground">{tradeFlags.isSwap ? "Receive" : "Market"}</span>
        <span className="flex min-w-0 items-center justify-end gap-1.5 font-medium">
          <TokenIcon symbol={toTokenLabel.replace(/^T/, "")} size={16} />
          <span className="min-w-0 truncate">{toTokenLabel}/USD</span>
        </span>
      </div>
    </div>
  )
}

function formatTokenLabel(value: string): string {
  return getToken(value)?.symbol ?? formatAddress(value)
}
