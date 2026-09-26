import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { normalizeQueryNetwork } from "../lib/query-keys"
import { invalidateMutationOutcome } from "@/shared/lib/mutation-invalidation"
import { CONTRACTS } from "@/app/config/contracts"
import { sorobanRpc } from "@/lib/soroban/client"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

const POLL_INTERVAL_MS = 5000
const TARGET_EVENTS = ["OrderExecuted", "OrderCancelled"]

function extractEventText(event: unknown): string {
  try {
    return JSON.stringify(event)
  } catch {
    return String(event)
  }
}

export function useOrderEventPolling() {
  const account = useWalletStore((state) => state.address)
  const network = useWalletStore((state) => state.network)
  const queryClient = useQueryClient()
  const lastCursor = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  // OB-117: identifies which account+network subscription an in-flight poll
  // belongs to. Effect cleanup bumps this so a poll that was already
  // in-flight when the account/network changed can detect, right after its
  // await resolves, that it is no longer current — instead of only being
  // stopped from rescheduling itself. Without this, a delayed response for
  // the old account/network could still invalidate caches and advance the
  // cursor after the user had already switched away.
  const generation = useRef(0)

  useEffect(() => {
    if (!account) return

    const currentGeneration = ++generation.current
    const isCurrent = () => generation.current === currentGeneration
    lastCursor.current = null

    const poll = async () => {
      try {
        const params: Record<string, unknown> = {
          type: "contract",
          contractId: CONTRACTS.exchangeRouter,
          limit: 50,
          order: "asc",
        }

        if (lastCursor.current) {
          params.cursor = lastCursor.current
        }

        const response = await sorobanRpc.getEvents(params as any)

        // OB-117: the account/network may have changed while this request
        // was in flight. Discard the response entirely rather than letting
        // it touch the cache, cursor, or schedule another poll under the
        // wrong identity.
        if (!isCurrent()) return

        const events = response.events

        const matching = events.filter((event) => {
          const text = extractEventText(event).toLowerCase()
          const isOrderEvent = TARGET_EVENTS.some((target) =>
            text.includes(target.toLowerCase()),
          )
          const isForAccount = account ? text.includes(account.toLowerCase()) : false
          return isOrderEvent && isForAccount
        })

        if (matching.length > 0) {
          const queryNetwork = normalizeQueryNetwork(network)
          const hasExecution = matching.some((event) =>
            extractEventText(event).toLowerCase().includes("orderexecuted"),
          )
          const hasCancellation = matching.some((event) =>
            extractEventText(event).toLowerCase().includes("ordercancelled"),
          )

          await Promise.all([
            ...(hasExecution
              ? [
                  invalidateMutationOutcome(queryClient, "fill", {
                    account,
                    network: queryNetwork,
                  }),
                ]
              : []),
            ...(hasCancellation
              ? [
                  invalidateMutationOutcome(queryClient, "cancel", {
                    account,
                    network: queryNetwork,
                  }),
                ]
              : []),
          ])
        }

        if (!isCurrent()) return

        if (response.cursor) {
          lastCursor.current = response.cursor
        } else {
          const lastEvent = events.at(-1)
          if (lastEvent?.id) lastCursor.current = lastEvent.id
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn("Order event polling failed", error)
      } finally {
        if (isCurrent()) {
          timer.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }

    void poll()

    return () => {
      generation.current += 1
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
    // `network` is intentionally a dependency (OB-117): switching networks
    // with the same wallet address must tear down and restart this
    // subscription from a fresh cursor rather than keep polling against
    // whichever network was active when the effect first ran.
  }, [account, network, queryClient])
}
