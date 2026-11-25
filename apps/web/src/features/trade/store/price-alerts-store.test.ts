import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  thresholdErrorMessage,
  usePriceAlertsStore,
  validateThreshold,
  requestNotificationPermission,
  fireNotification,
} from "./price-alerts-store"
import type { PriceAlert } from "./price-alerts-store"

// ─── validateThreshold ────────────────────────────────────────────────────────

describe("validateThreshold", () => {
  it("returns 'market-required' when marketName is blank", () => {
    expect(validateThreshold("100", "")).toBe("market-required")
    expect(validateThreshold("100", "   ")).toBe("market-required")
  })

  it("returns 'empty' for an empty string", () => {
    expect(validateThreshold("", "BTC/USD")).toBe("empty")
    expect(validateThreshold("   ", "BTC/USD")).toBe("empty")
  })

  it("returns 'non-numeric' for non-numeric input", () => {
    expect(validateThreshold("abc", "BTC/USD")).toBe("non-numeric")
    expect(validateThreshold("1e999", "BTC/USD")).toBe("non-numeric") // Infinity
    expect(validateThreshold("NaN", "BTC/USD")).toBe("non-numeric")
  })

  it("returns 'zero' for 0", () => {
    expect(validateThreshold("0", "BTC/USD")).toBe("zero")
  })

  it("returns 'negative' for negative numbers", () => {
    expect(validateThreshold("-1", "BTC/USD")).toBe("negative")
    expect(validateThreshold("-0.0001", "BTC/USD")).toBe("negative")
  })

  it("returns null for a valid positive threshold", () => {
    expect(validateThreshold("65000", "BTC/USD")).toBeNull()
    expect(validateThreshold("0.0001", "BTC/USD")).toBeNull()
    expect(validateThreshold("1.23e4", "BTC/USD")).toBeNull()
  })
})

// ─── thresholdErrorMessage ────────────────────────────────────────────────────

describe("thresholdErrorMessage", () => {
  it("returns a non-empty string for every error code", () => {
    const codes = ["empty", "non-numeric", "zero", "negative", "market-required"] as const
    for (const code of codes) {
      const msg = thresholdErrorMessage(code)
      expect(typeof msg).toBe("string")
      expect(msg.length).toBeGreaterThan(0)
    }
  })
})

// ─── usePriceAlertsStore ──────────────────────────────────────────────────────

describe("usePriceAlertsStore", () => {
  beforeEach(() => {
    localStorage.clear()
    usePriceAlertsStore.setState({ alerts: [] })
  })

  it("starts with an empty alert list", () => {
    expect(usePriceAlertsStore.getState().alerts).toHaveLength(0)
  })

  it("addAlert creates an enabled alert with a generated id and timestamps", () => {
    const { addAlert } = usePriceAlertsStore.getState()
    const alert = addAlert({
      marketName: "BTC/USD",
      indexTokenAddress: "addr-btc",
      threshold: 65_000,
      direction: "above",
    })

    expect(alert.id).toBeTruthy()
    expect(alert.enabled).toBe(true)
    expect(alert.firedAt).toBeNull()
    expect(typeof alert.createdAt).toBe("string")
    expect(usePriceAlertsStore.getState().alerts).toHaveLength(1)
  })

  it("removeAlert deletes the alert by id", () => {
    const { addAlert, removeAlert } = usePriceAlertsStore.getState()
    const alert = addAlert({
      marketName: "ETH/USD",
      indexTokenAddress: "addr-eth",
      threshold: 2_000,
      direction: "below",
    })
    removeAlert(alert.id)
    expect(usePriceAlertsStore.getState().alerts).toHaveLength(0)
  })

  it("setAlertEnabled toggles the enabled flag", () => {
    const { addAlert, setAlertEnabled } = usePriceAlertsStore.getState()
    const alert = addAlert({
      marketName: "BTC/USD",
      indexTokenAddress: "addr-btc",
      threshold: 50_000,
      direction: "below",
    })

    setAlertEnabled(alert.id, false)
    expect(usePriceAlertsStore.getState().alerts[0]?.enabled).toBe(false)

    setAlertEnabled(alert.id, true)
    expect(usePriceAlertsStore.getState().alerts[0]?.enabled).toBe(true)
  })

  it("markAlertFired sets firedAt and disables the alert", () => {
    // Suppress browser Notification in jsdom.
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "default", requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    })

    const { addAlert, markAlertFired } = usePriceAlertsStore.getState()
    const alert = addAlert({
      marketName: "BTC/USD",
      indexTokenAddress: "addr-btc",
      threshold: 65_000,
      direction: "above",
    })

    markAlertFired(alert.id)
    const updated = usePriceAlertsStore.getState().alerts[0]!
    expect(updated.enabled).toBe(false)
    expect(typeof updated.firedAt).toBe("string")
  })

  it("clearFiredAlerts removes only triggered alerts", () => {
    const { addAlert, markAlertFired, clearFiredAlerts } =
      usePriceAlertsStore.getState()

    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "default", requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    })

    const a1 = addAlert({
      marketName: "BTC/USD",
      indexTokenAddress: "addr-btc",
      threshold: 65_000,
      direction: "above",
    })
    addAlert({
      marketName: "ETH/USD",
      indexTokenAddress: "addr-eth",
      threshold: 2_000,
      direction: "below",
    })

    markAlertFired(a1.id)
    clearFiredAlerts()

    const remaining = usePriceAlertsStore.getState().alerts
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.marketName).toBe("ETH/USD")
  })
})

// ─── requestNotificationPermission ───────────────────────────────────────────

describe("requestNotificationPermission", () => {
  it("returns 'unavailable' when the Notification API is absent", async () => {
    const original = globalThis.Notification
    // @ts-expect-error – intentionally removing the API to test the fallback
    delete globalThis.Notification
    const result = await requestNotificationPermission()
    expect(result).toBe("unavailable")
    // Restore
    globalThis.Notification = original
  })

  it("returns existing permission without re-requesting when already granted", async () => {
    const requestMock = vi.fn()
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "granted", requestPermission: requestMock },
      configurable: true,
      writable: true,
    })

    const result = await requestNotificationPermission()
    expect(result).toBe("granted")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("returns 'denied' when requestPermission rejects", async () => {
    Object.defineProperty(globalThis, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockRejectedValue(new Error("blocked")),
      },
      configurable: true,
      writable: true,
    })

    const result = await requestNotificationPermission()
    expect(result).toBe("denied")
  })

  it("calls requestPermission and returns the resolved value", async () => {
    Object.defineProperty(globalThis, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("denied"),
      },
      configurable: true,
      writable: true,
    })

    const result = await requestNotificationPermission()
    expect(result).toBe("denied")
  })
})

// ─── fireNotification — permission-denied fallback ────────────────────────────

describe("fireNotification — permission-denied fallback", () => {
  it("does not construct a Notification when permission is denied", () => {
    const constructorSpy = vi.fn()
    Object.defineProperty(globalThis, "Notification", {
      value: Object.assign(constructorSpy, { permission: "denied" }),
      configurable: true,
      writable: true,
    })

    const alert: PriceAlert = {
      id: "test-1",
      marketName: "BTC/USD",
      indexTokenAddress: "addr-btc",
      threshold: 65_000,
      direction: "above",
      enabled: false,
      createdAt: new Date().toISOString(),
      firedAt: new Date().toISOString(),
    }

    fireNotification(alert)
    expect(constructorSpy).not.toHaveBeenCalled()
  })

  it("constructs a Notification when permission is granted", () => {
    const constructorSpy = vi.fn()
    Object.defineProperty(globalThis, "Notification", {
      value: Object.assign(constructorSpy, { permission: "granted" }),
      configurable: true,
      writable: true,
    })

    const alert: PriceAlert = {
      id: "test-2",
      marketName: "ETH/USD",
      indexTokenAddress: "addr-eth",
      threshold: 2_000,
      direction: "below",
      enabled: false,
      createdAt: new Date().toISOString(),
      firedAt: new Date().toISOString(),
    }

    fireNotification(alert)
    expect(constructorSpy).toHaveBeenCalledOnce()
    expect(constructorSpy).toHaveBeenCalledWith(
      expect.stringContaining("ETH/USD"),
      expect.objectContaining({ tag: `price-alert-${alert.id}` }),
    )
  })
})
