import { rpc as StellarRpc } from "@stellar/stellar-sdk/minimal"
import { sorobanRpc } from "./client"
import type { Transaction } from "@stellar/stellar-sdk/minimal"

// Stroops to XLM conversion (1 XLM = 10,000,000 stroops)
const STROOPS_PER_XLM = 10_000_000

export interface FeeEstimate {
  /** Total fee in XLM (formatted to 7 decimal places) */
  total: string
}

/**
 * Simulates a Soroban transaction to get resource requirements
 * Throws with diagnostic error if simulation fails
 *
 * @param tx - The transaction to simulate
 * @returns Simulation response with resource estimates
 * @throws Error with Soroban diagnostic event string on simulation failure
 */
export async function simulateTx(
  tx: Transaction,
): Promise<StellarRpc.Api.SimulateTransactionResponse> {
  try {
    const simulation = await sorobanRpc.simulateTransaction(tx)

    if (StellarRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    return simulation
  } catch (error) {
    if (error instanceof Error && error.message.includes("simulation failed")) {
      throw error
    }
    throw new Error(
      `Failed to simulate transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Estimates transaction fee from a simulation result (minResourceFee in stroops → XLM)
 *
 * @param simulation - The simulation response from simulateTx
 * @returns Fee estimate in XLM
 */
export function estimateFeeFromSimulation(
  simulation: StellarRpc.Api.SimulateTransactionSuccessResponse,
): FeeEstimate {
  const minResourceFeeStroops = parseInt(simulation.minResourceFee) || 0
  const totalXlm = formatStroopsToXlm(minResourceFeeStroops)

  return { total: totalXlm }
}

/**
 * Simulates a transaction and estimates fees in one call
 *
 * @param tx - The transaction to simulate
 * @returns Fee estimate in XLM
 * @throws Error if simulation fails
 */
export async function estimateFee(tx: Transaction): Promise<FeeEstimate> {
  const simulation = await simulateTx(tx)
  if (StellarRpc.Api.isSimulationSuccess(simulation)) {
    return estimateFeeFromSimulation(simulation)
  }
  return { total: "0.0000000" }
}

/**
 * Formats stroops to XLM with 7 decimal places
 */
function formatStroopsToXlm(stroops: number): string {
  const xlm = stroops / STROOPS_PER_XLM
  return xlm.toFixed(7)
}
