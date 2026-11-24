import { useEffect, useId, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Numeric } from "@workspace/ui/components/numeric"
import { cn } from "@workspace/ui/lib/utils"
import {
  PARTIAL_CLOSE_PRESETS,
  estimateClosePreview,
  formatPartialPresetUsd,
} from "../../lib/partial-close"
import { toConstraintState, validateClosePayload } from "../../lib/position-constraints"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import type { Position } from "../../hooks/usePositions"
import { formatUsd } from "@/shared/lib/format"

export type ClosePositionPayload = {
  isFull: boolean
  sizeDeltaUsd: number
}

type Props = {
  position: Position | null
  open: boolean
  onClose: () => void
  onConfirm: (payload: ClosePositionPayload) => void | Promise<unknown>
  isSubmitting?: boolean
  errorMessage?: string | null
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  )
}

export function ClosePositionDialog({
  position,
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  errorMessage = null,
}: Props) {
  const [closeType, setCloseType] = useState<"full" | "partial">("full")
  const [partialUsd, setPartialUsd] = useState("")
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [internalSubmitting, setInternalSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const inputId = useId()
  const errorId = useId()
  const presetRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const positionKey = position?.key ?? null

  useEffect(() => {
    if (!open) return
    setCloseType("full")
    setPartialUsd("")
    setActivePreset(null)
    setInternalSubmitting(false)
    setSubmitError(null)
  }, [open, positionKey])

  if (!position) return null

  const busy = isSubmitting || internalSubmitting
  const partialAmount = Number.parseFloat(partialUsd)
  const effectivePartialAmount = Number.isFinite(partialAmount) ? partialAmount : 0
  const sizeDeltaUsd = closeType === "full" ? position.sizeUsd : effectivePartialAmount

  const validationError = validateClosePayload(
    { isFull: closeType === "full", sizeDeltaUsd },
    toConstraintState(position),
  )

  const isValid = validationError === null
  const preview = estimateClosePreview(
    position,
    effectivePartialAmount,
    closeType === "full",
  )
  const pnlRole = preview.estimatedPnlUsd >= 0 ? "positive" : "negative"
  const displayError = errorMessage ?? submitError

  function handleSelectPreset(percent: number) {
    if (!position) return
    if (percent === 100) {
      setCloseType("full")
      setActivePreset(100)
      setPartialUsd("")
      return
    }
    setCloseType("partial")
    setActivePreset(percent)
    setPartialUsd(formatPartialPresetUsd(position.sizeUsd, percent))
  }

  function handlePresetKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentPercent: number,
  ) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const idx = PARTIAL_CLOSE_PRESETS.indexOf(
      currentPercent as (typeof PARTIAL_CLOSE_PRESETS)[number],
    )
    const last = PARTIAL_CLOSE_PRESETS.length - 1
    let nextIdx = idx
    if (event.key === "ArrowLeft") nextIdx = idx <= 0 ? last : idx - 1
    else if (event.key === "ArrowRight") nextIdx = idx >= last ? 0 : idx + 1
    else if (event.key === "Home") nextIdx = 0
    else nextIdx = last

    const nextPercent = PARTIAL_CLOSE_PRESETS[nextIdx]
    presetRefs.current.get(nextPercent)?.focus()
  }

  async function handleConfirm() {
    if (!isValid || busy) return
    setSubmitError(null)

    try {
      const result = onConfirm({ isFull: closeType === "full", sizeDeltaUsd })
      if (isPromiseLike(result)) {
        setInternalSubmitting(true)
        const outcome = await result
        setInternalSubmitting(false)
        if (outcome === null) {
          setSubmitError("Close order was not submitted. Review the amount and try again.")
          return
        }
        onClose()
      } else {
        onClose()
      }
    } catch (error) {
      setInternalSubmitting(false)
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit close order",
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            Close Position — {position.marketName}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleConfirm()
          }}
          className="space-y-4 py-2 text-sm"
        >
          <div className="space-y-1.5 rounded-lg border border-border/50 bg-surface-sunken p-3">
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">Position Size</span>
              <span className="font-mono font-medium">{formatUsd(position.sizeUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">Side</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  position.isLong ? "text-long" : "text-short",
                )}
              >
                <span aria-hidden="true">{position.isLong ? "↗" : "↘"}</span>
                <span>{position.isLong ? "Long" : "Short"}</span>
              </span>
            </div>
          </div>

          <div className="flex gap-2" role="group" aria-label="Close mode">
            <button
              type="button"
              aria-pressed={closeType === "full"}
              disabled={busy}
              onClick={() => {
                setCloseType("full")
                setActivePreset(null)
              }}
              className={cn(
                "touch-target flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors max-sm:min-h-11",
                closeType === "full"
                  ? "bg-muted text-foreground"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              Full close
            </button>
            <button
              type="button"
              aria-pressed={closeType === "partial"}
              disabled={busy}
              onClick={() => {
                setCloseType("partial")
                if (activePreset === 100) setActivePreset(null)
              }}
              className={cn(
                "touch-target flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors max-sm:min-h-11",
                closeType === "partial"
                  ? "bg-muted text-foreground"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              Partial close
            </button>
          </div>

          {closeType === "full" && (
            <p className="text-xs text-text-secondary">
              Closes the entire position of {formatUsd(position.sizeUsd)}.
            </p>
          )}

          {closeType === "partial" && (
            <div className="space-y-2">
              <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
                Size to close (USD)
              </label>
              <div className="relative">
                <Input
                  id={inputId}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={partialUsd}
                  disabled={busy}
                  aria-invalid={Boolean(validationError) && partialUsd !== ""}
                  aria-describedby={validationError ? errorId : undefined}
                  onChange={(e) => {
                    setPartialUsd(e.target.value)
                    setActivePreset(null)
                  }}
                  className="pe-14 font-mono text-sm"
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-secondary">
                  USD
                </span>
              </div>
              <div
                className="flex gap-2 pt-1 sm:gap-1.5"
                role="group"
                aria-label="Partial close presets"
              >
                {PARTIAL_CLOSE_PRESETS.map((percent) => (
                  <button
                    key={percent}
                    ref={(el) => {
                      if (el) presetRefs.current.set(percent, el)
                      else presetRefs.current.delete(percent)
                    }}
                    type="button"
                    disabled={busy}
                    aria-pressed={activePreset === percent}
                    className={cn(
                      "touch-target flex-1 rounded-sm border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11 max-sm:min-w-11",
                      activePreset === percent
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-text-secondary hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => handleSelectPreset(percent)}
                    onKeyDown={(e) => handlePresetKeyDown(e, percent)}
                    aria-label={`Close ${percent}% of position`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              {validationError && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  {validationError}
                </p>
              )}
            </div>
          )}

          {closeType === "full" && validationError && (
            <p role="alert" className="text-xs text-destructive">
              {validationError}
            </p>
          )}

          {/* Live close & PnL preview */}
          <div
            className="space-y-1.5 rounded-sm border border-border/60 bg-surface-sunken p-2.5 text-xs"
            aria-live="polite"
            aria-label="Close preview"
          >
            <div className="flex justify-between gap-3">
              <span className="text-text-secondary">Est. realized PnL</span>
              {preview.hasValidSize ? (
                <span className="inline-flex items-center gap-1 font-mono font-medium">
                  <Numeric value={preview.estimatedPnlUsd} format="usd" role={pnlRole} />
                  <span className="text-text-secondary">(</span>
                  <Numeric value={preview.estimatedPnlPct} format="pct" role={pnlRole} />
                  <span className="text-text-secondary">)</span>
                </span>
              ) : (
                <span className="font-mono text-text-secondary">—</span>
              )}
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-secondary">Position after close</span>
              <span className="font-mono font-medium">
                {formatUsd(preview.remainingSizeUsd)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-secondary">Remaining collateral (Est.)</span>
              <span className="font-mono font-medium">
                {formatUsd(preview.remainingCollateralUsd)}
              </span>
            </div>
          </div>

          {displayError && (
            <p
              role="alert"
              className="rounded-sm border border-danger-border bg-danger-subtle p-2 text-xs text-danger"
            >
              {displayError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              pending={busy}
              disabled={!isValid || busy}
            >
              {busy ? "Submitting…" : "Confirm Close"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
