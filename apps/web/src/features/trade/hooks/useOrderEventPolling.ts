import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CONTRACTS } from "@/app/config/contracts"
import { queryContractEvents } from "@/lib/soroban/events"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import {
  decodeOrderEvent,
  applyOrderEventRefreshMatrix,
} from "../lib/order-event-decoder"

const CHAIN_ID = "stellar-mainnet"
const POLL_INTERVAL_MS = 5000
const PAGE_LIMIT = 50
const MAX_PAGES_PER_POLL = 10

function getCursorStorageKey(account: string): string {
  return `so4:order-events:cursor:${account}`
}

export function loadPersistedCursor(account: string): string | null {
  try {
    return localStorage.getItem(getCursorStorageKey(account))
  } catch {
    return null
  }
}

export function savePersistedCursor(account: string, cursor: string) {
  try {
    localStorage.setItem(getCursorStorageKey(account), cursor)
  } catch {}
}

export function useOrderEventPolling() {
  const account = useWalletStore((state) => state.address)
  const queryClient = useQueryClient()
  const cursorRef = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  const processedEventIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!account) return

    let cancelled = false
    // Restore persisted cursor for this account or null
    cursorRef.current = loadPersistedCursor(account)
    processedEventIds.current.clear()

    const poll = async () => {
      try {
        let pagesProcessed = 0
        let hasMore = true

        while (hasMore && !cancelled && pagesProcessed < MAX_PAGES_PER_POLL) {
          const currentCursor = cursorRef.current ?? undefined

          // Fetch typed contract events from Soroban RPC
          const page = await queryContractEvents({
            contractId: CONTRACTS.exchangeRouter,
            cursor: currentCursor,
            limit: PAGE_LIMIT,
          })

          if (cancelled) return

          const events = page.events ?? []

          // If no events returned, we've reached the tip of the stream
          if (events.length === 0) {
            if (page.cursor && page.cursor !== currentCursor) {
              cursorRef.current = page.cursor
              savePersistedCursor(account, page.cursor)
            }
            break
          }

          // Process each event in the page with typed decoding
          for (const rawEvent of events) {
            if (!rawEvent || !rawEvent.id) continue

            // Deduplicate across pages/restarts
            if (processedEventIds.current.has(rawEvent.id)) {
              continue
            }

            const decoded = decodeOrderEvent(rawEvent)
            if (!decoded) continue

            // Decoded identity check: ensure event belongs to connected account
            if (decoded.account && decoded.account.toLowerCase() === account.toLowerCase()) {
              await applyOrderEventRefreshMatrix(
                queryClient,
                decoded.name,
                CHAIN_ID,
                account,
              )
            }

            processedEventIds.current.add(rawEvent.id)
          }

          // Bound memory for processed event IDs
          if (processedEventIds.current.size > 1000) {
            const arr = Array.from(processedEventIds.current)
            processedEventIds.current = new Set(arr.slice(arr.length - 500))
          }

          // Advance cursor ONLY after successfully processing all events on this page
          if (page.cursor && page.cursor !== currentCursor) {
            cursorRef.current = page.cursor
            savePersistedCursor(account, page.cursor)
          } else {
            // No next cursor provided; stop paginating this cycle
            break
          }

          pagesProcessed++
          hasMore = events.length === PAGE_LIMIT
        }
      } catch (error) {
        // Do NOT advance cursor on error — failure before cursor advancement ensures no event is skipped
        if (import.meta.env.DEV) console.warn("Order event polling failed", error)
      } finally {
        if (!cancelled) {
          timer.current = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [account, queryClient])
}
