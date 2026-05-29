import { useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { Separator } from "@workspace/ui/components/separator"
import { Badge } from "@workspace/ui/components/badge"
import { useTradeState } from "../../hooks/useTradeState"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { useTradeFees } from "../../hooks/useTradeFees"
import { useTokenBalances } from "../../../wallet/hooks/useTokenBalances"
import {
  estimateLiquidationPrice,
  formatUsd,
  sizeFromCollateralAndLeverage,
} from "../../lib/trade-math"
import { TradeInfoRows } from "./TradeInfoRows"
import { ConfirmationDialog } from "./ConfirmationDialog"
import { ApplyReferralCodePrompt } from "./ApplyReferralCodePrompt"
import type { TradeType } from "../../hooks/useTradeState"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export function TradePanel() {
  const trade = useTradeState()
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
  const collateralUsd = parseFloat(debouncedFromAmount || "0") * getMidPrice(collateralAddress)
  const sizeUsd = tradeFlags.isSwap ? collateralUsd : sizeFromCollateralAndLeverage(collateralUsd, leverage)

  const fees = useTradeFees({ sizeUsd, marketAddress, isIncrease: true, tradeType })
  const walletBalance = balances?.[fromTokenAddress]
  const xlmBalance = balances?.["XLM"] ?? 0
  const collateralAmount = Number(fromAmount || "0")
  const hasCollateralError = walletBalance !== undefined && collateralAmount > walletBalance
  const hasXlmError = xlmBalance < fees.executionFeeXlm
  const validationError = hasCollateralError
    ? `Insufficient ${fromTokenAddress} balance`
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
    <div className="flex flex-col gap-3 p-4">
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
        {tradeType} {!tradeFlags.isSwap && toTokenAddress}
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
  const { fromAmount, fromTokenAddress, toTokenAddress, tradeFlags, setFromAmount, switchTokens } = trade
  const { getMidPrice } = useTokenPrices()
  const { data: balances } = useTokenBalances()

  const fromPrice = getMidPrice(fromTokenAddress)
  const fromUsd = parseFloat(fromAmount || "0") * fromPrice
  const walletBalance = balances?.[fromTokenAddress]

  return (
    <div className="mt-3 space-y-2">
      {/* Pay */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            {tradeFlags.isSwap ? "Pay" : "Collateral"}
          </label>
          {walletBalance !== undefined && (
            <span className="text-xs text-muted-foreground">
              Balance:{" "}
              <span className="font-mono font-medium text-foreground">
                {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {fromTokenAddress}
              </span>
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="pr-16 font-mono text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {fromTokenAddress}
          </span>
        </div>
        {fromUsd > 0 && (
          <p className="text-right text-xs text-muted-foreground">{formatUsd(fromUsd)}</p>
        )}
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{tradeFlags.isSwap ? "Receive" : "Market"}</span>
        <span className="font-medium">{toTokenAddress}/USD</span>
      </div>
    </div>
  )
}
