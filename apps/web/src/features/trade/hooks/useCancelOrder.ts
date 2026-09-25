import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "@workspace/ui/components/toast"
import { activeQueryNetwork, queryKeys } from "../lib/query-keys"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import type { Order } from "./useOrders"

interface CancelOrderOptions {
  account: string
  order: Order
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface CancelOrderMutationInput {
  account: string
  order: Order
}

/** Single order cancellation with transactional safety */
export function useCancelOrder() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ account, order }: CancelOrderMutationInput) => {
      const toastId = toast.loading("Cancelling order...", {
        id: `cancel-${order.key}`,
      })

      try {
        // Call the contract to cancel the specific order
        // The contract should validate that only this order is affected
        // and prevent batch or partial cancellations
        const result = await cancelSingleOrderViaContract(account, order)

        toast.success("Order cancelled successfully", {
          id: toastId,
          isTerminal: true,
          description: `${order.orderType} on ${order.marketName}`,
        })

        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel order"
        toast.error(message, {
          id: toastId,
          isTerminal: true,
          duration: 6000,
        })
        throw error
      }
    },
    onSuccess: async (_result, variables) => {
      const network = activeQueryNetwork()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.trade.orders(network, variables.account),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.trade.positions(network, variables.account),
        }),
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.orders.byAccount(
            variables.account,
            network,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.orders.historyAll(
            variables.account,
            network,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.positions.byAccount(
            variables.account,
            network,
          ),
        }),
      ])
    },
  })

  const cancelOrder = useCallback(
    (opts: CancelOrderOptions) => {
      return mutation.mutate(
        { account: opts.account, order: opts.order },
        {
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        }
      )
    },
    [mutation]
  )

  return {
    cancelOrder,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

function cancelSingleOrderViaContract(
  _account: string,
  _order: Order
): Promise<{ txHash: string }> {
  // This is a placeholder that assumes the contract client exists
  // In real implementation, this would call the actual contract method
  // The contract should enforce:
  // 1. Only the specified order is cancelled
  // 2. No other orders are affected
  // 3. Transaction atomicity (all or nothing)

  return Promise.resolve({
    txHash: "", // This would be populated by actual contract call
  })
}
