import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { createDecreaseOrder, createIncreaseOrder } from "../../lib/stellar"
import { activeQueryNetwork, queryKeys } from "../../lib/query-keys"
import type { Position } from "../../hooks/usePositions"
import { formatUsd } from "@/shared/lib/format"
import { useTokenBalances } from "@/features/wallet/hooks/useTokenBalances"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { getOrderVaultCapability } from "../../lib/order-vault-capability"

type Props = {
  position: Position | null
  mode: "add" | "remove" | null
  open: boolean
  onClose: () => void
  onSubmit?: (amount: number) => Promise<string | null>
}

export function CollateralDialog({ position, mode, open, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const account = useWalletStore((state) => state.address)
  const { data: balances } = useTokenBalances()
  const { getMidPrice } = useTokenPrices()
  const queryClient = useQueryClient()

  // OB-089: Check whether the OrderVault is a real deployed contract.
  // Deposit (add collateral) goes through the vault; withdrawal (remove
  // collateral) creates a DecreaseOrder and does not touch the vault directly.
  // Only block "add" mode — "remove" is still backed by an executable path.
  const vaultCapability = getOrderVaultCapability()
  const isDepositBlocked = mode === "add" && !vaultCapability.isDeployed

  // Reset inputs when opened/closed/changed
  useEffect(() => {
    if (open) {
      setAmount("")
      setErrorMsg(null)
    }
  }, [open, position, mode])

  if (!position || !mode) return null

  const tokenSymbol = position.collateralToken
  const walletBalance = balances?.[tokenSymbol] ?? 0
  const tokenPrice = getMidPrice(tokenSymbol) || (position.collateralAmount > 0 ? position.collateralUsd / position.collateralAmount : 0)
  
  const amountNum = parseFloat(amount) || 0
  const deltaUsd = amountNum * tokenPrice
  
  let newCollateralUsd = position.collateralUsd
  if (mode === "add") {
    newCollateralUsd = position.collateralUsd + deltaUsd
  } else {
    newCollateralUsd = Math.max(0, position.collateralUsd - deltaUsd)
  }

  const currentLeverage = position.collateralUsd > 0 ? position.sizeUsd / position.collateralUsd : 0
  const newLeverage = newCollateralUsd > 0 ? position.sizeUsd / newCollateralUsd : 0

  // Validate inputs
  // OB-089: A stub vault must never produce a successful deposit response.
  // Setting isValid=false here ensures both the UI button and handleConfirm()
  // are blocked — defence-in-depth against any path that could reach submit.
  let isValid = amountNum > 0 && !isDepositBlocked
  let validationError = isDepositBlocked ? (vaultCapability.unavailableReason ?? "") : ""

  if (amountNum > 0 && !isDepositBlocked) {
    if (mode === "add") {
      if (amountNum > walletBalance) {
        isValid = false
        validationError = "Insufficient wallet balance"
      }
    } else {
      if (amountNum >= position.collateralAmount) {
        isValid = false
        validationError = "Cannot remove all collateral (Close position instead)"
      } else if (newLeverage > 50) {
        isValid = false
        validationError = "New leverage exceeds maximum allowed (50x)"
      }
    }
  }

  async function handleConfirm() {
    const pos = position
    if (!account || !pos || !isValid) return
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      if (onSubmit) {
        const hash = await onSubmit(amountNum)
        if (hash) onClose()
        return
      }

      // 1% slippage buffer so price fluctuation between submit and execution doesn't fail the order
      const addAcceptable  = pos.isLong ? pos.markPrice * 1.01 : pos.markPrice * 0.99
      const removeAcceptable = pos.isLong ? pos.markPrice * 0.99 : pos.markPrice * 1.01

      if (mode === "add") {
        await createIncreaseOrder({
          account,
          marketAddress: pos.marketAddress,
          collateralToken: pos.collateralToken,
          collateralAmount: amountNum,
          sizeDeltaUsd: 0, // collateral-only increase
          isLong: pos.isLong,
          acceptablePrice: addAcceptable,
          orderType: "MarketIncrease",
          leverage: Math.round(newLeverage),
        })
      } else {
        await createDecreaseOrder({
          account,
          positionKey: pos.key,
          marketAddress: pos.marketAddress,
          collateralToken: pos.collateralToken,
          collateralDeltaAmount: amountNum,
          sizeDeltaUsd: 0, // collateral-only decrease
          isLong: pos.isLong,
          acceptablePrice: removeAcceptable,
          orderType: "MarketDecrease",
          receiveToken: pos.collateralToken,
        })
      }
      
      // Invalidate queries to refresh list
      await queryClient.invalidateQueries({
        queryKey: queryKeys.positions(activeQueryNetwork(), account),
      })
      onClose()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === "add" ? "Add Collateral" : "Remove Collateral"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            {title} — {position.marketName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* OB-089: Inform the user when collateral transfer is unavailable because
              the OrderVault contract is not deployed on this network. */}
          {isDepositBlocked && (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"
            >
              {vaultCapability.unavailableReason}
            </p>
          )}
          {/* Market Status details */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border/50">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Position Size</span>
              <span className="font-mono font-medium">{formatUsd(position.sizeUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Current Collateral</span>
              <span className="font-mono font-medium">
                {position.collateralAmount.toFixed(4)} {tokenSymbol} ({formatUsd(position.collateralUsd)})
              </span>
            </div>
            {mode === "add" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Wallet Balance</span>
                <span className="font-mono text-xs font-medium">
                  {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}
                </span>
              </div>
            )}
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">
                Amount to {mode === "add" ? "deposit" : "withdraw"}
              </label>
              {mode === "add" && (
                <button
                  type="button"
                  onClick={() => setAmount(walletBalance.toString())}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Use Max
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                disabled={isSubmitting}
                onChange={(e) => setAmount(e.target.value)}
                className="pe-16 font-mono text-sm"
              />
              <span className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                {tokenSymbol}
              </span>
            </div>
            {deltaUsd > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                ≈ {formatUsd(deltaUsd)}
              </p>
            )}
          </div>

          {/* Leverage Transition Preview */}
          <div className="border-t border-border/50 pt-3 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Leverage Preview</h4>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 p-2.5 border border-border/30">
              <span className="text-xs text-muted-foreground">Leverage</span>
              <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span>{currentLeverage.toFixed(2)}x</span>
                {amountNum > 0 && isValid && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <span className={mode === "add" ? "text-green-500" : "text-amber-500"}>
                      {newLeverage.toFixed(2)}x
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Validation & Error Messages */}
          {validationError && (
            <p className="text-xs font-medium text-red-500">{validationError}</p>
          )}
          {errorMsg && (
            <p className="text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              Warning: {errorMsg}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !isValid}
            className={mode === "add" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
          >
            {isSubmitting ? "Submitting..." : `Confirm ${title}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
