import { useEffect, useRef, useState } from "react"
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
  detectFillDuringEditing,
  getOrderAmendCapability,
  validateAmendPayload,
  type AmendPayload,
  type AmendReplaceOutcome,
} from "../../lib/order-amendment"
import type { OrderLifecycleStage } from "../../lib/order-lifecycle"
import type { OrderType } from "../../hooks/useOrders"
import { formatUsd } from "@/shared/lib/format"

export type AmendTarget = {
  orderKey: string
  marketName: string
  orderType: OrderType
  isLong: boolean
  triggerPrice: number
  remainingSizeUsd: number
  filledSizeUsd: number
  stage: OrderLifecycleStage
  awaitingIndex?: boolean
}

type Props = {
  order: AmendTarget | null
  open: boolean
  onClose: () => void
  onSubmit: (payload: AmendPayload) => Promise<AmendReplaceOutcome>
  /**
   * History rows do not carry the original trigger/collateral, so only size
   * edits are offered there. Trigger edits stay in the open-orders table
   * where the original order details are known.
   */
  sizeOnly?: boolean
}

export function AmendOrderDialog({ order, open, onClose, onSubmit, sizeOnly = false }: Props) {
  const [trigger, setTrigger] = useState("")
  const [size, setSize] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  const [filledAtOpen, setFilledAtOpen] = useState(0)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setTrigger("")
      setSize("")
      setResultError(null)
      setIsSubmitting(false)
      setFilledAtOpen(order?.filledSizeUsd ?? 0)
    }
    wasOpen.current = open
  }, [open, order])

  if (!order) return null

  const capability = getOrderAmendCapability({
    orderType: order.orderType,
    stage: order.stage,
    awaitingIndex: order.awaitingIndex,
  })

  const parsedTrigger = trigger === "" || sizeOnly ? undefined : Number.parseFloat(trigger)
  const parsedSize = size === "" ? undefined : Number.parseFloat(size)
  const payload: AmendPayload = {
    ...(parsedTrigger !== undefined && Number.isFinite(parsedTrigger) ? { triggerPrice: parsedTrigger } : {}),
    ...(parsedSize !== undefined && Number.isFinite(parsedSize) ? { sizeUsd: parsedSize } : {}),
  }

  const fillConflict = detectFillDuringEditing(filledAtOpen, order.filledSizeUsd)
  const validationError =
    fillConflict ??
    validateAmendPayload(payload, {
      orderType: order.orderType,
      stage: order.stage,
      awaitingIndex: order.awaitingIndex,
      currentTriggerPrice: order.triggerPrice,
      remainingSizeUsd: order.remainingSizeUsd,
      filledSizeUsd: order.filledSizeUsd,
    })

  const isValid = capability.canAmend && !validationError && (trigger !== "" || size !== "")

  async function handleConfirm() {
    if (!isValid) return
    setIsSubmitting(true)
    setResultError(null)
    try {
      const outcome = await onSubmit(payload)
      if (outcome.status === "replaced") {
        onClose()
        return
      }
      if (outcome.status === "replace-failed") {
        // The original is gone — never imply it is still live. Keep the dialog
        // open on this explicit terminal state so the trader can resubmit.
        setResultError(
          `Original order cancelled, but the replacement failed: ${outcome.error}. The original is no longer live — review and place a new order manually.`,
        )
        return
      }
      setResultError(outcome.error)
    } catch (error) {
      setResultError(error instanceof Error ? error.message : "Amendment failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            Amend order — {order.marketName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <p className="text-xs text-muted-foreground">
            This venue has no in-place order update. Amendments run as two separate steps —
            cancel the resting order, then create a replacement. The replacement loses queue
            priority and joins the back of the queue at the new price and size.
          </p>

          {!capability.canAmend ? (
            <p role="alert" className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning-foreground">
              {capability.reason ?? "This order cannot be amended in its current state."}
            </p>
          ) : (
            <>
              {capability.canAmendTrigger && !sizeOnly ? (
                <div className="space-y-1">
                  <label htmlFor="amend-trigger-price" className="text-xs font-medium text-muted-foreground">
                    Trigger price (USD)
                  </label>
                  <Input
                    id="amend-trigger-price"
                    type="number"
                    placeholder={order.triggerPrice > 0 ? order.triggerPrice.toString() : "0.00"}
                    value={trigger}
                    onChange={(event) => setTrigger(event.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ) : null}

              {capability.canAmendSize ? (
                <div className="space-y-1">
                  <label htmlFor="amend-size" className="text-xs font-medium text-muted-foreground">
                    Size (USD, up to {formatUsd(order.remainingSizeUsd)} remaining)
                  </label>
                  <Input
                    id="amend-size"
                    type="number"
                    placeholder={order.remainingSizeUsd.toString()}
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ) : null}

              {validationError && (trigger !== "" || size !== "" || fillConflict) ? (
                <p role="alert" className="text-xs text-destructive">{validationError}</p>
              ) : null}

              {resultError ? (
                <p role="alert" className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-foreground">
                  {resultError}
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Replacing…" : "Cancel and replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
