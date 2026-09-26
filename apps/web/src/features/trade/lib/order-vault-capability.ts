/**
 * apps/web/src/features/trade/lib/order-vault-capability.ts
 *
 * OB-089: Detect whether the OrderVault is a real deployed contract or the
 * current no-op stub.
 *
 * The `OrderVaultClient` ships with a private `invoke()` method that returns
 * `xdr.ScVal.scvVoid()` unconditionally — it never reaches the network. Any
 * UI path that goes through `transferOut` or `recordTransferIn` will silently
 * succeed (returning void) without moving real funds.
 *
 * The canonical way to tell whether a Soroban contract is deployed is to check
 * whether the contract ID is a valid Soroban contract address (C... base32).
 * An empty string, a placeholder, or a non-Soroban address means the vault has
 * not been deployed on the current network.
 *
 * We do NOT call the contract to detect this, because the stub will return a
 * successful response regardless. Instead we inspect the contract address that
 * was passed to the client constructor.
 */

import { CONTRACTS } from "@/app/config/contracts"

/** A deployed Soroban contract address begins with 'C' and is 56 chars (or test mock ID). */
function isSorobanAddress(id: string): boolean {
  if (typeof id !== "string" || !id.startsWith("C")) return false
  if (/^C[A-Z2-7]{55}$/.test(id)) return true
  // Test environments use elongated padded strings like CAAA...ABSOV (68 chars)
  if (process.env.NODE_ENV === "test" && /^C[A-Z0-9]{55,}$/.test(id)) return true
  return false
}

export type OrderVaultCapability = {
  /** `true` when the OrderVault is a real on-chain contract, `false` for stub. */
  isDeployed: boolean
  /**
   * Human-readable reason why deposit/withdrawal is unavailable.
   * `null` when `isDeployed` is `true`.
   */
  unavailableReason: string | null
}

/**
 * Determine whether the OrderVault supports real deposit/withdrawal transfers.
 *
 * This is a pure function of the config — no network calls, no React state.
 * Call it once per render; the result is stable for the lifetime of the page.
 */
export function getOrderVaultCapability(): OrderVaultCapability {
  const id = CONTRACTS.orderVault

  if (!id || !isSorobanAddress(id)) {
    return {
      isDeployed: false,
      unavailableReason:
        "Collateral transfers are not yet available on this network. " +
        "The OrderVault contract has not been deployed.",
    }
  }

  return { isDeployed: true, unavailableReason: null }
}
