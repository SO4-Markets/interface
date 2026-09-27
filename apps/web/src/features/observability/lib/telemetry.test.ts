import { beforeEach, describe, expect, it } from "vitest"
import {
  BoundedRingBuffer,
  TelemetryManager,
  sanitizeTelemetryString,
} from "./telemetry"

describe("telemetry (OB-126)", () => {
  let mgr: TelemetryManager

  beforeEach(() => {
    mgr = new TelemetryManager()
  })

  describe("BoundedRingBuffer", () => {
    it("drops oldest elements when exceeding capacity", () => {
      const buffer = new BoundedRingBuffer<number>(3)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      expect(buffer.getAll()).toEqual([1, 2, 3])

      buffer.push(4)
      expect(buffer.getAll()).toEqual([2, 3, 4])
      expect(buffer.size()).toBe(3)
    })
  })

  describe("sanitizeTelemetryString (Privacy Guard)", () => {
    it("scrubs Stellar public keys and contract addresses", () => {
      const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      const contract = "CA3D5KRYMCMCZVAC7G3L7AITWB4YDTKTOWWLVODBRD5NOVI73PC5AZST"
      const text = `User ${address} called contract ${contract}`
      const sanitized = sanitizeTelemetryString(text)
      expect(sanitized).toBe("User [SCRUBBED_ADDRESS] called contract [SCRUBBED_ADDRESS]")
      expect(sanitized).not.toContain(address)
      expect(sanitized).not.toContain(contract)
    })

    it("scrubs emails and query secrets", () => {
      const input = "Contact user@example.com at /api/test?token=secret123&other=val"
      const sanitized = sanitizeTelemetryString(input)
      expect(sanitized).toBe("Contact [SCRUBBED_EMAIL] at /api/test?token=[SCRUBBED]&other=val")
      expect(sanitized).not.toContain("user@example.com")
      expect(sanitized).not.toContain("secret123")
    })
  })

  describe("Route transition tracking", () => {
    it("computes percentiles and device breakdowns", () => {
      mgr.recordRouteTransition("/trade/xlm-usdc", "/trade/btc-usdc", 100, "desktop")
      mgr.recordRouteTransition("/trade/btc-usdc", "/earn", 200, "desktop")
      mgr.recordRouteTransition("/earn", "/trade/xlm-usdc", 300, "mobile")

      const summary = mgr.getSummary()
      expect(summary.routeTransitions.count).toBe(3)
      expect(summary.routeTransitions.byDevice.desktop).toBe(2)
      expect(summary.routeTransitions.byDevice.mobile).toBe(1)
      expect(summary.routeTransitions.p50Ms).toBe(200)
    })
  })

  describe("Feed health tracking", () => {
    it("tracks disconnects and reconnection latency", () => {
      mgr.recordFeedHealth("XLM-USDC", "connect")
      mgr.recordFeedHealth("XLM-USDC", "disconnect")
      mgr.recordFeedHealth("XLM-USDC", "reconnect", 1500)

      const summary = mgr.getSummary()
      expect(summary.feedHealth.disconnectCount).toBe(1)
      expect(summary.feedHealth.avgReconnectMs).toBe(1500)
      expect(summary.feedHealth.activeFeeds).toContain("XLM-USDC")
    })
  })

  describe("Transaction latency isolation", () => {
    it("isolates client prep, network confirmation, and indexer catch-up stages", () => {
      mgr.recordTransactionLatency({
        operationType: "CREATE_ORDER",
        clientPrepMs: 250,
        networkConfirmMs: 3200,
        indexerCatchupMs: 1100,
      })

      const summary = mgr.getSummary()
      expect(summary.transactionLatency.count).toBe(1)
      expect(summary.transactionLatency.avgClientPrepMs).toBe(250)
      expect(summary.transactionLatency.avgNetworkConfirmMs).toBe(3200)
      expect(summary.transactionLatency.avgIndexerCatchupMs).toBe(1100)
      expect(summary.transactionLatency.avgTotalMs).toBe(4550)
    })
  })
})
