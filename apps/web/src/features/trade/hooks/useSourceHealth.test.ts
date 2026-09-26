/**
 * OB-058: Source health derivation tests.
 *
 * Verifies distinct behavior for: initial load, empty venue, connected,
 * stale, reconnecting, rate-limited, revision gap, and error states.
 */

import { describe, expect, it } from "vitest"
import { deriveSourceHealth, formatStaleDuration } from "./useSourceHealth"

describe("deriveSourceHealth", () => {
  const now = 1000000

  describe("initial-load", () => {
    it("identifies first connection with no data", () => {
      const health = deriveSourceHealth(
        { status: "connecting", hasData: false, lastDataTime: null },
        now,
        0
      )

      expect(health.status).toBe("initial-load")
      expect(health.isExecutable).toBe(false)
      expect(health.message).toContain("Connecting")
    })
  })

  describe("empty-venue", () => {
    it("identifies connected state with no executable depth", () => {
      const health = deriveSourceHealth(
        { status: "connected", hasData: false, lastDataTime: null },
        now,
        0
      )

      expect(health.status).toBe("empty-venue")
      expect(health.isExecutable).toBe(false)
      expect(health.message).toContain("no executable depth")
    })
  })

  describe("connected", () => {
    it("identifies live updates flowing", () => {
      const lastDataTime = now - 1000
      const health = deriveSourceHealth(
        { status: "connected", hasData: true, lastDataTime },
        now,
        0
      )

      expect(health.status).toBe("connected")
      expect(health.isExecutable).toBe(true)
      expect(health.reconnectAttempt).toBe(0)
      expect(health.message).toContain("Live")
    })
  })

  describe("stale", () => {
    it("identifies disconnected with old data", () => {
      const lastDataTime = now - 30000 // 30s ago
      const health = deriveSourceHealth(
        { status: "disconnected", hasData: true, lastDataTime },
        now,
        0
      )

      expect(health.status).toBe("stale")
      expect(health.isExecutable).toBe(false)
      expect(health.staleDuration).toBe(30000)
      expect(health.message).toContain("last known data")
    })

    it("shows duration in message for stale data > 60s", () => {
      const lastDataTime = now - 75000 // 75s ago
      const health = deriveSourceHealth(
        { status: "disconnected", hasData: true, lastDataTime },
        now,
        0
      )

      expect(health.status).toBe("stale")
      expect(health.message).toContain("75s ago")
    })
  })

  describe("reconnecting", () => {
    it("identifies connection attempt with existing data", () => {
      const lastDataTime = now - 5000
      const health = deriveSourceHealth(
        { status: "connecting", hasData: true, lastDataTime },
        now,
        0  // first attempt, no prior reconnects
      )

      expect(health.status).toBe("reconnecting")
      expect(health.isExecutable).toBe(false)
      expect(health.reconnectAttempt).toBe(0)
    })

    it("shows stale for disconnected state with data", () => {
      const lastDataTime = now - 2000
      const health = deriveSourceHealth(
        { status: "disconnected", hasData: true, lastDataTime },
        now,
        2
      )

      expect(health.status).toBe("stale")  // disconnected + data = stale
      expect(health.isExecutable).toBe(false)
    })
  })

  describe("rate-limited", () => {
    it("detects throttling after repeated reconnect attempts", () => {
      const lastDataTime = now - 10000
      const health = deriveSourceHealth(
        { status: "disconnected", hasData: true, lastDataTime },
        now,
        3  // 3rd attempt
      )

      expect(health.status).toBe("rate-limited")
      expect(health.isExecutable).toBe(false)
      expect(health.message).toContain("Rate limited")
    })

    it("remains rate-limited through multiple attempts", () => {
      const lastDataTime = now - 8000
      const health = deriveSourceHealth(
        { status: "disconnected", hasData: true, lastDataTime },
        now,
        5  // 5th attempt
      )

      expect(health.status).toBe("rate-limited")
      expect(health.reconnectAttempt).toBe(5)
    })

    it("exits rate-limited state after threshold", () => {
      const lastDataTime = now - 12000
      const health = deriveSourceHealth(
        { status: "connecting", hasData: true, lastDataTime },
        now,
        6  // beyond threshold, back to reconnecting
      )

      // Falls back to reconnecting after rate-limit window
      expect(health.status).toBe("reconnecting")
    })
  })

  describe("revision-gap", () => {
    it("detects sequence gap during reconnect with data", () => {
      const lastDataTime = now - 3000
      const health = deriveSourceHealth(
        { status: "connecting", hasData: true, lastDataTime },
        now,
        2  // reconnect attempt 2, before rate-limit threshold
      )

      expect(health.status).toBe("revision-gap")
      expect(health.isExecutable).toBe(false)
      expect(health.message).toContain("Resyncing")
    })
  })

  describe("error", () => {
    it("identifies unrecoverable error state", () => {
      const health = deriveSourceHealth(
        { status: "error", hasData: false, lastDataTime: null },
        now,
        2
      )

      expect(health.status).toBe("error")
      expect(health.isExecutable).toBe(false)
      expect(health.message).toContain("error")
    })

    it("preserves last data time on error", () => {
      const lastDataTime = now - 5000
      const health = deriveSourceHealth(
        { status: "error", hasData: true, lastDataTime },
        now,
        1
      )

      expect(health.status).toBe("error")
      expect(health.lastUpdateTime).toBe(lastDataTime)
    })
  })

  describe("isExecutable flag", () => {
    it("allows actions only when connected", () => {
      const testCases: Array<{
        input: Parameters<typeof deriveSourceHealth>[0]
        expected: boolean
      }> = [
        { input: { status: "connecting", hasData: false, lastDataTime: null }, expected: false },
        { input: { status: "connected", hasData: false, lastDataTime: null }, expected: false },
        { input: { status: "connected", hasData: true, lastDataTime: now }, expected: true },
        { input: { status: "disconnected", hasData: true, lastDataTime: now - 1000 }, expected: false },
        { input: { status: "error", hasData: true, lastDataTime: now }, expected: false },
      ]

      testCases.forEach(({ input, expected }) => {
        const health = deriveSourceHealth(input, now, 0)
        expect(health.isExecutable).toBe(expected)
      })
    })
  })
})

describe("formatStaleDuration", () => {
  it("formats seconds", () => {
    expect(formatStaleDuration(5000)).toBe("5s ago")
    expect(formatStaleDuration(45000)).toBe("45s ago")
  })

  it("formats minutes", () => {
    expect(formatStaleDuration(60000)).toBe("1m ago")
    expect(formatStaleDuration(120000)).toBe("2m ago")
    expect(formatStaleDuration(3540000)).toBe("59m ago")
  })

  it("formats hours", () => {
    expect(formatStaleDuration(3600000)).toBe("1h ago")
    expect(formatStaleDuration(7200000)).toBe("2h ago")
    expect(formatStaleDuration(36000000)).toBe("10h ago")
  })
})
