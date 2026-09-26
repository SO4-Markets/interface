import { beforeEach, describe, expect, it, vi } from "vitest"
import { xdr } from "@stellar/stellar-sdk"
import type { QueryClient } from "@tanstack/react-query"
import type { ContractEvent } from "@/lib/soroban/events"
import {
  decodeOrderEvent,
  applyOrderEventRefreshMatrix,
} from "../lib/order-event-decoder"
import {
  loadPersistedCursor,
  savePersistedCursor,
} from "./useOrderEventPolling"

const TEST_ACCOUNT = "GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ"
const OTHER_ACCOUNT = "GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34"

function makeScValSymbol(sym: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(sym)
}

function makeScValString(str: string): xdr.ScVal {
  return xdr.ScVal.scvString(str)
}

function makeTestEvent(overrides: Partial<ContractEvent> = {}): ContractEvent {
  return {
    id: "evt-001",
    type: "contract",
    ledger: 100,
    ledgerClosedAt: "2026-09-24T00:00:00Z",
    txHash: "0x123",
    contractId: "CAAA",
    topics: [makeScValSymbol("OrderExecuted"), makeScValString(TEST_ACCOUNT)],
    value: xdr.ScVal.scvVoid(),
    ...overrides,
  }
}

describe("Order Event Decoding & Refresh Matrix (OB-112)", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe("decodeOrderEvent", () => {
    it("decodes OrderExecuted with account in topic[1]", () => {
      const event = makeTestEvent()
      const decoded = decodeOrderEvent(event)

      expect(decoded).not.toBeNull()
      expect(decoded?.name).toBe("OrderExecuted")
      expect(decoded?.account).toBe(TEST_ACCOUNT)
    })

    it("decodes OrderCancelled with case-insensitivity", () => {
      const event = makeTestEvent({
        topics: [makeScValSymbol("ordercancelled"), makeScValString(TEST_ACCOUNT)],
      })
      const decoded = decodeOrderEvent(event)

      expect(decoded?.name).toBe("OrderCancelled")
    })

    it("decodes OrderCreated and OrderUpdated", () => {
      const created = decodeOrderEvent(
        makeTestEvent({ topics: [makeScValSymbol("OrderCreated"), makeScValString(TEST_ACCOUNT)] }),
      )
      const updated = decodeOrderEvent(
        makeTestEvent({ topics: [makeScValSymbol("OrderUpdated"), makeScValString(TEST_ACCOUNT)] }),
      )

      expect(created?.name).toBe("OrderCreated")
      expect(updated?.name).toBe("OrderUpdated")
    })

    it("handles malformed events safely without throwing", () => {
      const noTopics = makeTestEvent({ topics: [] })
      expect(decodeOrderEvent(noTopics)).toBeNull()

      const nullEvent = null as unknown as ContractEvent
      expect(decodeOrderEvent(nullEvent)).toBeNull()
    })
  })

  describe("applyOrderEventRefreshMatrix", () => {
    it("invalidates positions, orders, balances, and marketsInfo on OrderExecuted", async () => {
      const invalidateMock = vi.fn().mockResolvedValue(undefined)
      const mockQueryClient = {
        invalidateQueries: invalidateMock,
      } as unknown as QueryClient

      await applyOrderEventRefreshMatrix(
        mockQueryClient,
        "OrderExecuted",
        "stellar-mainnet",
        TEST_ACCOUNT,
      )

      expect(invalidateMock).toHaveBeenCalledTimes(5)
    })

    it("invalidates orders and balances on OrderCancelled", async () => {
      const invalidateMock = vi.fn().mockResolvedValue(undefined)
      const mockQueryClient = {
        invalidateQueries: invalidateMock,
      } as unknown as QueryClient

      await applyOrderEventRefreshMatrix(
        mockQueryClient,
        "OrderCancelled",
        "stellar-mainnet",
        TEST_ACCOUNT,
      )

      expect(invalidateMock).toHaveBeenCalledTimes(2)
    })

    it("invalidates only orders on OrderUpdated", async () => {
      const invalidateMock = vi.fn().mockResolvedValue(undefined)
      const mockQueryClient = {
        invalidateQueries: invalidateMock,
      } as unknown as QueryClient

      await applyOrderEventRefreshMatrix(
        mockQueryClient,
        "OrderUpdated",
        "stellar-mainnet",
        TEST_ACCOUNT,
      )

      expect(invalidateMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("Cursor Persistence & Recovery", () => {
    it("persists and reloads cursor scoped by account", () => {
      expect(loadPersistedCursor(TEST_ACCOUNT)).toBeNull()

      savePersistedCursor(TEST_ACCOUNT, "cursor-abc-123")
      expect(loadPersistedCursor(TEST_ACCOUNT)).toBe("cursor-abc-123")
      expect(loadPersistedCursor(OTHER_ACCOUNT)).toBeNull()
    })
  })

  describe("Burst processing & Deduplication", () => {
    it("processes burst across multiple pages and deduplicates repeated event IDs", async () => {
      const invalidateMock = vi.fn().mockResolvedValue(undefined)
      const mockQueryClient = {
        invalidateQueries: invalidateMock,
      } as unknown as QueryClient

      const processedIds = new Set<string>()

      const page1 = [
        makeTestEvent({ id: "evt-1", topics: [makeScValSymbol("OrderExecuted"), makeScValString(TEST_ACCOUNT)] }),
        makeTestEvent({ id: "evt-2", topics: [makeScValSymbol("OrderCancelled"), makeScValString(OTHER_ACCOUNT)] }),
      ]

      const page2 = [
        makeTestEvent({ id: "evt-1", topics: [makeScValSymbol("OrderExecuted"), makeScValString(TEST_ACCOUNT)] }), // duplicate
        makeTestEvent({ id: "evt-3", topics: [makeScValSymbol("OrderCancelled"), makeScValString(TEST_ACCOUNT)] }),
      ]

      let matchingCount = 0

      for (const batch of [page1, page2]) {
        for (const raw of batch) {
          if (processedIds.has(raw.id)) continue
          processedIds.add(raw.id)

          const decoded = decodeOrderEvent(raw)
          if (decoded && decoded.account === TEST_ACCOUNT) {
            matchingCount++
            await applyOrderEventRefreshMatrix(
              mockQueryClient,
              decoded.name,
              "stellar-mainnet",
              TEST_ACCOUNT,
            )
          }
        }
      }

      // evt-1 (matching) and evt-3 (matching) processed exactly once; evt-1 duplicate ignored
      expect(matchingCount).toBe(2)
      expect(processedIds.size).toBe(3)
    })
  })
})
