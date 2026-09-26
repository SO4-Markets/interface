import { useMemo, useState, useEffect } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Numeric } from "@workspace/ui/components/numeric"
import { toast } from "@workspace/ui/components/toast"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { useTradeFees } from "../../hooks/useTradeFees"
import { useTokenBalances } from "../../../wallet/hooks/useTokenBalances"
// NB: useTokenBalances is also consumed here (not only in TradeInputs) to
// validate the entered amount against the wallet balance before submit.
import {
  estimateLiquidationPrice,
  sizeFromCollateralAndLeverage,
} from "../../lib/trade-math"
import { getToken } from "../../data/tokens"
import { TradeInfoRows } from "./TradeInfoRows"
import { ConfirmationDialog } from "./ConfirmationDialog"
import { ApplyReferralCodePrompt } from "./ApplyReferralCodePrompt"
import { LeverageSlider } from "./LeverageSlider"
import type { TradeMode, TradeType, useTradeState } from "../../hooks/useTradeState"
import { NumberInput } from "@/shared/components/NumberInput"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { formatAddress } from "@/shared/lib/format"
import {
  validateAmount,
  validatePrice,
  validateBalance,
} from "@/lib/input-validation"

type TradeController = ReturnType<typeof useTradeState>

type TradePanelProps = {
  trade: TradeController
}

export function TradePanel({ trade }: TradePanelProps) {
  const { getMidPrice, isStale } = useTokenPrices()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [priceValidationError, setPriceValidationError] = useState<string | null>(null)
  const [previousMode, setPreviousMode] = useState<TradeMode>(trade.tradeMode)
  const account = useWalletStore((state) => state.address)

  const {
    tradeType,
    tradeMode,
    tradeFlags,
    fromAmount,
    leverage,
    toTokenAddress,
    marketAddress,
    collateralAddress,
    availableTradeModes,
    setTradeType,
    setTradeMode,
    setLeverage,
    setTriggerPrice,
    advanced,
  } = trade

  const entryPrice = getMidPrice(toTokenAddress)
  // Collateral is configured per market and side, so it can be unset; an
  // unknown key prices at 0, which is the right "no collateral selected" value.
  const collateralUsd =
    parseFloat(fromAmount || "0") * getMidPrice(collateralAddress ?? "")
  const sizeUsd = tradeFlags.isSwap
    ? collateralUsd
    : sizeFromCollateralAndLeverage(collateralUsd, leverage)

  const fees = useTradeFees({
    sizeUsd,
    marketAddress,
    isIncrease: true,
    tradeType,
  })

  const liquidationPrice = useMemo(() => {
    if (!tradeFlags.isPosition || sizeUsd <= 0 || entryPrice <= 0) return 0
    return estimateLiquidationPrice({
      entryPrice,
      collateralUsd,
      sizeUsd,
      isLong: tradeFlags.isLong,
    })
  }, [tradeFlags, sizeUsd, entryPrice, collateralUsd])

  const priceStale = isStale(toTokenAddress)
  const toTokenLabel = formatTokenLabel(toTokenAddress)
  const canTrade = Boolean(account) && sizeUsd > 0 && !priceStale

  // Detect mode changes and notify user about discarded fields
  useEffect(() => {
    if (tradeMode === previousMode) return

    const wasPriceMode = previousMode === "Limit" || previousMode === "Trigger"
    const isPriceMode = tradeMode === "Limit" || tradeMode === "Trigger"

    if (wasPriceMode && !isPriceMode) {
      // Switching from Limit/Trigger to Market — price is discarded
      toast.show({
        variant: "info",
        message: "Limit price cleared",
        description: `Switched to ${tradeMode} order. Limit price field has been cleared.`,
      })
    } else if (!wasPriceMode && isPriceMode) {
      // Switching from Market to Limit/Trigger — will need to enter price
      toast.show({
        variant: "info",
        message: `${tradeMode} price required`,
        description: `Enter ${tradeMode === "Limit" ? "limit" : "trigger"} price to proceed.`,
      })
    }

    setPreviousMode(tradeMode)
  }, [tradeMode, previousMode])

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      {/* ── Trade type tabs: Long / Short / Swap ───────────────────── */}
      <Tabs
        value={tradeType}
        onValueChange={(v) => setTradeType(v as TradeType)}
      >
        <TabsList className="w-full">
          <TabsTrigger
            value="Long"
            className="flex-1 text-green-500 data-[state=active]:text-green-400"
          >
            Long
          </TabsTrigger>
          <TabsTrigger
            value="Short"
            className="flex-1 text-red-500 data-[state=active]:text-red-400"
          >
            Short
          </TabsTrigger>
          <TabsTrigger value="Swap" className="flex-1">
            Swap
          </TabsTrigger>
        </TabsList>

        {/* ── Order mode: Market / Limit / Trigger ─────────────────── */}
        <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as TradeMode)}>
          <TabsList variant="line" className="w-full transition-all duration-base">
            {availableTradeModes.map((mode) => (
              <TabsTrigger key={mode} value={mode} className="flex-1 transition-colors duration-fast">
                {mode}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <TabsContent value="Long" className="mt-0">
          <TradeInputs trade={trade} />
        </TabsContent>
        <TabsContent value="Short" className="mt-0">
          <TradeInputs trade={trade} />
        </TabsContent>
        <TabsContent value="Swap" className="mt-0">
          <TradeInputs trade={trade} />
        </TabsContent>
      </Tabs>

      {/* ── Trigger price input (Limit / Stop-Loss only) ─────────── */}
      {(tradeMode === "Limit" || tradeMode === "Trigger") && (
        <div className="space-y-1 animate-in fade-in duration-base">
          <label className="text-xs text-muted-foreground">
            {tradeMode === "Trigger" ? "Trigger price" : "Limit price"}
          </label>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              className="pe-12 font-mono text-sm"
              onChange={(e) => {
                const value = e.target.value
                setTriggerPrice(value)
                if (value) {
                  const validation = validatePrice(value)
                  setPriceValidationError(validation.error)
                } else {
                  setPriceValidationError(null)
                }
              }}
            />
            <span className="absolute top-1/2 inset-inline-end-3 -translate-y-1/2 text-xs text-muted-foreground">
              USD
            </span>
          </div>
          {priceValidationError && (
            <p className="text-xs text-red-500">{priceValidationError}</p>
          )}
        </div>
      )}

      {/* ── Leverage slider (positions only) ─────────────────────── */}
      {tradeFlags.isPosition && (
        <div className="animate-in fade-in duration-base">
          <LeverageSlider value={leverage} onChange={setLeverage} />
        </div>
      )}

      {/* ── Size summary ─────────────────────────────────────────── */}
      {tradeFlags.isPosition && sizeUsd > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Position size</span>
          <Numeric value={sizeUsd} format="usd" role="neutral" className="font-medium" />
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
                  className="pe-10 font-mono text-sm"
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

      {/* ── Wallet disconnected state ──────────────────────────────── */}
      {!account && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
          Connect wallet to trade
        </div>
      )}

      {/* ── Price stale warning ────────────────────────────────────── */}
      {priceStale && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-500">
          <span>Waiting for price update…</span>
        </div>
      )}

      <Button
        className={`mt-1 w-full font-medium ${
          tradeFlags.isLong
            ? "bg-green-600 text-white hover:bg-green-700"
            : tradeFlags.isShort
              ? "bg-red-600 text-white hover:bg-red-700"
              : ""
        }`}
        disabled={!canTrade || priceValidationError !== null}
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
  const [amountValidationError, setAmountValidationError] = useState<string | null>(null)

  const activeInputTokenAddress = tradeFlags.isSwap ? fromTokenAddress : collateralAddress!
  const fromPrice = getMidPrice(activeInputTokenAddress)
  const fromUsd = parseFloat(fromAmount || "0") * fromPrice
  const walletBalance = balances?.[activeInputTokenAddress]
  const fromTokenLabel = formatTokenLabel(activeInputTokenAddress)
  const toTokenLabel = formatTokenLabel(toTokenAddress)

  const handleAmountChange = (value: string) => {
    setFromAmount(value)
    if (value) {
      const validation = validateAmount(value, { maxAmount: walletBalance })
      setAmountValidationError(validation.error)
      if (!validation.error && walletBalance !== undefined) {
        const balance = validateBalance(parseFloat(value), walletBalance)
        setAmountValidationError(balance.error)
      }
    } else {
      setAmountValidationError(null)
    }
  }

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
          onValueChange={handleAmountChange}
          placeholder="0.00"
          className="font-mono text-sm"
          onMax={walletBalance !== undefined ? () => {
            const maxStr = walletBalance.toString()
            handleAmountChange(maxStr)
          } : undefined}
          usdValue={fromUsd > 0 ? fromUsd : undefined}
        />
        {(validationError || amountValidationError) && (
          <p className="text-xs text-red-500 [overflow-wrap:anywhere]">{validationError || amountValidationError}</p>
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
