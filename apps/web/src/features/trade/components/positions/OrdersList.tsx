import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { useState } from "react"
import { useOrders, type Order } from "../../hooks/useOrders"
import { cancelOrder } from "../../lib/stellar"
import { formatUsd } from "../../lib/trade-math"
import type { OrderKey } from "@/lib/contracts/generated/exchange-router/src"

function toOrderKey(order: Order): OrderKey {
  return {
    orderType: order.orderType,
    account: order.account,
    market: order.marketAddress,
    index: 0n,
  }
}

export function OrdersList() {
  const { data: orders = [], isLoading } = useOrders()
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function handleCancel(order: Order) {
    setCancelling(order.key)
    try {
      await cancelOrder(order.account, toOrderKey(order))
    } finally {
      setCancelling(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No open orders
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2">Market</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Size</th>
            <th className="px-4 py-2">Trigger</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.key} className="border-b border-border/50">
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{o.marketName}</span>
                  <Badge
                    variant="secondary"
                    className={
                      o.isLong ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    }
                  >
                    {o.isLong ? "Long" : "Short"}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{o.orderType}</td>
              <td className="px-4 py-2 font-mono">{formatUsd(o.sizeUsd)}</td>
              <td className="px-4 py-2 font-mono">{formatUsd(o.triggerPrice)}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(o.createdAt).toLocaleTimeString()}
              </td>
              <td className="px-4 py-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={cancelling === o.key}
                  onClick={() => void handleCancel(o)}
                >
                  {cancelling === o.key ? "…" : "Cancel"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
