import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { Position } from "../../hooks/usePositions"
import { formatUsd } from "@/shared/lib/format"

const PARTIAL_PRESETS = [25, 50, 75] as const

export type ClosePositionPayload = {
  isFull: boolean
  sizeDeltaUsd: number
}

type Props = {
  position: Position | null
  open: boolean
  onClose: () => void
  onConfirm: (payload: ClosePositionPayload) => void
}

export function ClosePositionDialog({ position, open, onClose, onConfirm }: Props) {
  const [closeType, setCloseType] = useState<"full" | "partial">("full")
  const [partialUsd, setPartialUsd] = useState("")

  if (!position) return null

  const partialAmount = parseFloat(partialUsd) || 0

  let validationError = ""
  if (closeType === "partial") {
    if (partialAmount <= 0) {
      validationError = "Enter an amount greater than 0"
    } else if (partialAmount >= position.sizeUsd) {
      validationError = "Amount must be less than total position size (use Full close instead)"
    }
  }

  const isValid = closeType === "full" || (partialAmount > 0 && !validationError)
  const sizeDeltaUsd = closeType === "full" ? position.sizeUsd : partialAmount

  const positionSizeUsd = position.sizeUsd

  function setPreset(percent: number) {
    setPartialUsd((positionSizeUsd * percent / 100).toFixed(2))
  }

  function handleConfirm() {
    if (!isValid) return
    onConfirm({ isFull: closeType === "full", sizeDeltaUsd })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            Close Position — {position.marketName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border/50">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Position Size</span>
              <span className="font-mono font-medium">{formatUsd(position.sizeUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Side</span>
              <span className={`text-xs font-medium ${position.isLong ? "text-green-500" : "text-red-500"}`}>
                <span aria-hidden="true">{position.isLong ? "↗" : "↘"}</span>
                <span>{position.isLong ? "Long" : "Short"}</span>
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCloseType("full")}
              className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                closeType === "full"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Full close
            </button>
            <button
              type="button"
              onClick={() => setCloseType("partial")}
              className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                closeType === "partial"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Partial close
            </button>
          </div>

          {closeType === "full" && (
            <p className="text-xs text-muted-foreground">
              Closes the entire position of {formatUsd(position.sizeUsd)}.
            </p>
          )}

          {closeType === "partial" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Size to close (USD)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={partialUsd}
                  onChange={(e) => setPartialUsd(e.target.value)}
                  className="pe-14 font-mono text-sm"
                />
                <span className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  USD
                </span>
              </div>
              <div className="flex gap-1.5 pt-1" aria-label="Partial close presets">
                {PARTIAL_PRESETS.map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className="flex-1 rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setPreset(percent)}
                    aria-label={`Close ${percent}% of position`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              <div className="rounded border border-border/60 bg-muted/20 p-2 text-xs" aria-live="polite">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Position after close</span>
                  <span className="font-mono font-medium">{formatUsd(Math.max(0, position.sizeUsd - partialAmount))}</span>
                </div>
              </div>
              {validationError && (
                <p className="text-xs text-red-500">{validationError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Confirm Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
