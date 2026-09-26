/**
 * apps/web/src/features/trade/lib/order-vault-capability.test.ts
 *
 * OB-089: Regression tests ensuring the OrderVault stub guard is reliable.
 *
 * The acceptance criterion: no action must report "transferred funds" from a
 * stub/no-op response. This test suite verifies the detection path that gates
 * the UI — if `getOrderVaultCapability()` returns `isDeployed: false`, the
 * deposit/withdrawal UI must be disabled.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getOrderVaultCapability } from "./order-vault-capability"

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockContracts = { orderVault: "" }

vi.mock("@/app/config/contracts", () => ({
  get CONTRACTS() {
    return mockContracts
  },
}))

describe("getOrderVaultCapability (OB-089)", () => {
  beforeEach(() => {
    mockContracts.orderVault = ""
  })

  it("returns isDeployed=false when orderVault is an empty string (stub/undeployed)", () => {
    mockContracts.orderVault = ""
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(false)
    expect(result.unavailableReason).toMatch(/not yet available|not been deployed/i)
  })

  it("returns isDeployed=false when orderVault is a placeholder string", () => {
    mockContracts.orderVault = "PLACEHOLDER"
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(false)
    expect(result.unavailableReason).not.toBeNull()
  })

  it("returns isDeployed=false when orderVault is a non-Soroban address (e.g. EVM hex)", () => {
    mockContracts.orderVault = "0x1234567890abcdef1234567890abcdef12345678"
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(false)
  })

  it("returns isDeployed=true when orderVault is a valid Soroban C... address", () => {
    // A valid 56-char Soroban address starting with C
    mockContracts.orderVault = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(true)
    expect(result.unavailableReason).toBeNull()
  })

  it("returns isDeployed=true for a realistic-looking Soroban address", () => {
    mockContracts.orderVault = "CBD6BQSQFROWIIT5QCYN7KL5LJJWUIH7CEWUSZIFMUJO6NPXE6CVGYNW"
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(true)
    expect(result.unavailableReason).toBeNull()
  })

  it("returns isDeployed=false for a 55-char address (one char short — not a valid Soroban ID)", () => {
    mockContracts.orderVault = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"  // 55 chars
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(false)
  })

  it("returns isDeployed=false when orderVault starts with G (a Stellar account address, not a contract)", () => {
    mockContracts.orderVault = "GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1"
    const result = getOrderVaultCapability()
    expect(result.isDeployed).toBe(false)
  })
})
