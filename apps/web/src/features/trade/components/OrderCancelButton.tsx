import React from "react"
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

  const handleCancel = React.useCallback(async () => {
    if (!window.confirm(`Cancel ${order.orderType} on ${order.marketName}?`)) {
      return
    }

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
    <button
      onClick={handleCancel}
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
  )
}
