import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { formatUsd } from "../../lib/trade-math"
import type { Order } from "../../hooks/useOrders"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  isSubmitting: boolean
  onConfirm: () => Promise<void>
}

export function OrderCancelDialog({ open, onOpenChange, order, isSubmitting, onConfirm }: Props) {
  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Your order will be permanently cancelled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Market</span>
                <span className="font-medium">{order.marketName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      order.isLong ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    }
                  >
                    {order.isLong ? "Long" : "Short"}
                  </Badge>
                  <span className="font-medium text-xs">{order.orderType}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Size</span>
                <span className="font-mono font-medium">{formatUsd(order.sizeUsd)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trigger Price</span>
                <span className="font-mono font-medium">{formatUsd(order.triggerPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className="min-w-24"
          >
            {isSubmitting ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
