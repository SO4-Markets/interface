"use client"

import { useId, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  requestNotificationPermission,
  thresholdErrorMessage,
  usePriceAlertsStore,
  validateThreshold,
} from "../store/price-alerts-store"
import type { AlertDirection } from "../store/price-alerts-store"

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketOption = {
  /** Index-token address used to look up the live price. */
  indexTokenAddress: string
  /** Display name, e.g. "BTC/USD". */
  name: string
}

type Props = {
  open: boolean
  onClose: () => void
  markets: Array<MarketOption>
  /**
   * Pre-select a market when the dialog is opened from a market-specific
   * context (e.g. the market stats header).
   */
  defaultMarketAddress?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PriceAlertDialog({
  open,
  onClose,
  markets,
  defaultMarketAddress,
}: Props) {
  const addAlert = usePriceAlertsStore((s) => s.addAlert)

  const [selectedAddress, setSelectedAddress] = useState(
    defaultMarketAddress ?? markets[0]?.indexTokenAddress ?? "",
  )
  const [direction, setDirection] = useState<AlertDirection>("above")
  const [rawThreshold, setRawThreshold] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const thresholdId = useId()
  const marketSelectId = useId()
  const directionId = useId()

  function resetForm() {
    setSelectedAddress(defaultMarketAddress ?? markets[0]?.indexTokenAddress ?? "")
    setDirection("above")
    setRawThreshold("")
    setFieldError(null)
    setPermissionDenied(false)
    setSubmitted(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const market = markets.find((m) => m.indexTokenAddress === selectedAddress)
    const marketName = market?.name ?? ""

    const validationError = validateThreshold(rawThreshold, marketName)
    if (validationError) {
      setFieldError(thresholdErrorMessage(validationError))
      return
    }

    // Request notification permission at opt-in time, never assumed.
    const permission = await requestNotificationPermission()
    setPermissionDenied(permission === "denied")

    addAlert({
      marketName,
      indexTokenAddress: selectedAddress,
      threshold: Number(rawThreshold),
      direction,
    })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent aria-labelledby="price-alert-success-title">
          <DialogHeader>
            <DialogTitle id="price-alert-success-title">Alert set</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your price alert has been saved.{" "}
            {permissionDenied
              ? "Browser notifications are blocked — you will see an in-app notification instead when the price is reached."
              : "You will receive a browser notification when the price is reached."}
          </p>
          <DialogFooter>
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent aria-labelledby="price-alert-dialog-title">
        <DialogHeader>
          <DialogTitle id="price-alert-dialog-title">
            Set price alert
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Market selector */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={marketSelectId}
              className="text-xs font-medium text-muted-foreground"
            >
              Market
            </label>
            <select
              id={marketSelectId}
              value={selectedAddress}
              onChange={(e) => setSelectedAddress(e.target.value)}
              className="h-8 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {markets.map((m) => (
                <option key={m.indexTokenAddress} value={m.indexTokenAddress}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Direction toggle */}
          <div
            role="group"
            aria-labelledby={directionId}
            className="flex flex-col gap-1.5"
          >
            <span
              id={directionId}
              className="text-xs font-medium text-muted-foreground"
            >
              Alert when price is
            </span>
            <div className="flex gap-2">
              {(["above", "below"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 rounded-md border py-1.5 text-sm capitalize transition-colors ${
                    direction === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Threshold input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={thresholdId}
              className="text-xs font-medium text-muted-foreground"
            >
              Price threshold
            </label>
            <Input
              id={thresholdId}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="e.g. 65000"
              value={rawThreshold}
              onChange={(e) => {
                setRawThreshold(e.target.value)
                if (fieldError) setFieldError(null)
              }}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? `${thresholdId}-error` : undefined}
            />
            {fieldError && (
              <p
                id={`${thresholdId}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {fieldError}
              </p>
            )}
          </div>

          {/* Permission hint */}
          <p className="text-xs text-muted-foreground">
            You will be asked to allow browser notifications. If you decline,
            an in-app notification will appear instead.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Set alert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
