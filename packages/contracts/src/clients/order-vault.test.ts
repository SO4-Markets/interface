/**
 * packages/contracts/src/clients/order-vault.test.ts
 *
 * OB-089: Verification that the OrderVault stub cannot produce a successful
 * deposit or withdrawal response without an authoritative transaction path.
 */

import { describe, it, expect } from "vitest"
import { OrderVaultClient } from "./order-vault"

describe("OrderVaultClient stub protection (OB-089)", () => {
  const client = new OrderVaultClient("CBD6BQSQFROWIIT5QCYN7KL5LJJWUIH7CEWUSZIFMUJO6NPXE6CVGYNW")

  it("transferOut rejects and cannot produce a successful transfer", async () => {
    await expect(
      client.transferOut("GABCDEF123456", "CUSDC...", 1000000n),
    ).rejects.toThrow(/cannot be invoked directly/i)
  })

  it("recordTransferIn rejects and cannot produce a successful transfer", async () => {
    await expect(
      client.recordTransferIn("GABCDEF123456", "CUSDC...", 1000000n),
    ).rejects.toThrow(/cannot be invoked directly/i)
  })
})
