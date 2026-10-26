import { beforeEach, describe, expect, it, vi } from "vitest"
import { estimateFee, estimateFeeFromSimulation, simulateTx } from "./simulate"
import type { rpc as StellarRpc, Transaction  } from "@stellar/stellar-sdk/minimal"

const mockSimulateTransaction = vi.fn()

vi.mock("./client", () => ({
  sorobanRpc: { simulateTransaction: mockSimulateTransaction },
}))

// Minimal stand-in — simulateTx passes it straight to the (mocked) RPC client
const fakeTx = {} as Transaction

const successResponse = {
  cost: { cpuInsns: "1000", memBytes: "1000" },
  results: [{ auth: [], xdr: "AAAAAA==" }],
  minResourceFee: "1000000",
  latestLedger: 12345,
  transactionData: "",
} as unknown as StellarRpc.Api.SimulateTransactionSuccessResponse

const budgetErrorResponse = {
  error: "Budget exceeded: cpu instructions limit 100, used 200",
  latestLedger: 12345,
} as unknown as StellarRpc.Api.SimulateTransactionErrorResponse

describe("simulateTx", () => {
  beforeEach(() => {
    mockSimulateTransaction.mockReset()
  })

  it("returns the simulation response on success", async () => {
    mockSimulateTransaction.mockResolvedValue(successResponse)

    const result = await simulateTx(fakeTx)

    expect(result).toBe(successResponse)
    expect(mockSimulateTransaction).toHaveBeenCalledWith(fakeTx)
  })

  it("throws with a diagnostic message on simulation error", async () => {
    mockSimulateTransaction.mockResolvedValue(budgetErrorResponse)

    await expect(simulateTx(fakeTx)).rejects.toThrow("Transaction simulation failed")
    await expect(simulateTx(fakeTx)).rejects.toThrow("Budget exceeded")
  })

  it("throws a wrapped error on malformed / unexpected RPC response", async () => {
    mockSimulateTransaction.mockRejectedValue(new Error("Unexpected token in JSON"))

    await expect(simulateTx(fakeTx)).rejects.toThrow("Failed to simulate transaction")
  })
})

describe("estimateFeeFromSimulation", () => {
  it("converts minResourceFee from stroops to XLM with 7 decimal places", () => {
    // 1_000_000 stroops / 10_000_000 stroops-per-XLM = 0.1 XLM
    expect(estimateFeeFromSimulation(successResponse).total).toBe("0.1000000")
  })

  it("returns 0.0000000 XLM when minResourceFee is 0", () => {
    const zeroFee = {
      ...successResponse,
      minResourceFee: "0",
    }

    expect(estimateFeeFromSimulation(zeroFee).total).toBe("0.0000000")
  })
})

describe("estimateFee", () => {
  beforeEach(() => {
    mockSimulateTransaction.mockReset()
  })

  it("returns fee estimate from a successful simulation", async () => {
    mockSimulateTransaction.mockResolvedValue(successResponse)

    const result = await estimateFee(fakeTx)

    expect(result.total).toBe("0.1000000")
  })

  it("returns 0.0000000 when the response is not a recognised success type", async () => {
    // Malformed result that is neither success nor error
    mockSimulateTransaction.mockResolvedValue({ latestLedger: 12345 })

    const result = await estimateFee(fakeTx)

    expect(result.total).toBe("0.0000000")
  })
})
