import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { useCancelOrder } from "../hooks/useCancelOrder"
import type { Order } from "../hooks/useOrders"

interface OrderCancelButtonProps {
  order: Order
  account: string
  onCancelSuccess?: () => void
  className?: string
  variant?: "default" | "destructive" | "outline"
}

/**
 * Cancels a single order with full transactional integrity
 * Only the specified order is affected; no partial or batch operations
 */
export function OrderCancelButton({
  order,
  account,
  onCancelSuccess,
  className = "",
  variant = "destructive",
}: OrderCancelButtonProps) {
  const { cancelOrder, isPending } = useCancelOrder()

  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const handleConfirm = React.useCallback(() => {
    setConfirmOpen(false)
    cancelOrder({
      account,
      order,
      onSuccess: onCancelSuccess,
    })
  }, [cancelOrder, order, account, onCancelSuccess])

  const buttonClasses = {
    default: "bg-slate-700 text-white hover:bg-slate-600 disabled:bg-slate-800",
    destructive: "bg-red-700 text-white hover:bg-red-600 disabled:bg-red-800",
    outline: "border border-slate-600 text-slate-100 hover:bg-slate-800 disabled:opacity-50",
  }

  return (
    <>
    <button
      onClick={() => setConfirmOpen(true)}
      disabled={isPending || order.status !== "active"}
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        disabled:cursor-not-allowed
        ${buttonClasses[variant]}
        ${className}
      `}
      type="button"
      aria-label={`Cancel ${order.orderType} order`}
    >
      {isPending ? "Cancelling..." : "Cancel Order"}
    </button>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel order?</DialogTitle>
          <DialogDescription>
            Cancel {order.orderType} on {order.marketName}? This sends a cancellation transaction for this order only.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
