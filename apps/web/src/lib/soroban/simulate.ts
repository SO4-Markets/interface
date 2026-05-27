import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { sorobanRpc } from "./client"
import type { Transaction} from "@stellar/stellar-sdk";

// Stroops to XLM conversion (1 XLM = 10,000,000 stroops)
const STROOPS_PER_XLM = 10_000_000

export interface FeeEstimate {
  /** Inclusion fee in XLM (formatted to 7 decimal places) */
  inclusionFee: string
  /** Resource fee in XLM (formatted to 7 decimal places) */
  resourceFee: string
  /** Total fee in XLM (formatted to 7 decimal places) */
  total: string
}

/**
 * Simulates a Soroban transaction to get resource requirements
 * Throws with diagnostic error if simulation fails
 *
 * @param tx - The transaction to simulate (can be Transaction object or XDR string)
 * @returns Simulation response with resource estimates
 * @throws Error with Soroban diagnostic event string on simulation failure
 */
export async function simulateTx(
  tx: Transaction | string,
): Promise<StellarRpc.Api.SimulateTransactionResponse> {
  const xdrString = typeof tx === "string" ? tx : tx.toXDR()

  try {
    const simulation = await sorobanRpc.simulateTransaction(xdrString)

    // Check if simulation failed
    if (StellarRpc.Api.isSimulationError(simulation)) {
      let errorMessage = "Transaction simulation failed"

      // Extract diagnostic event string if available
      if (simulation.simulationData?.error) {
        errorMessage = `${errorMessage}: ${simulation.simulationData.error}`
      }

      throw new Error(errorMessage)
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
 * Estimates transaction fees from a simulation result
 * Formats fees in XLM with 7 decimal places for UI display
 *
 * @param simulation - The simulation response from simulateTx
 * @returns Fee estimates in XLM { inclusionFee, resourceFee, total }
 */
export function estimateFeeFromSimulation(
  simulation: StellarRpc.Api.SimulateTransactionResponse,
): FeeEstimate {
  // Extract fees from simulation result
  // The resultMetaXdr contains the fee information
  const inclusionFeeStroops = simulation.inclusionFee ?? "0"
  const resourceFeeStroops = simulation.resourceFee ?? "0"

  // Convert stroops to XLM and format to 7 decimal places
  const inclusionFeeXlm = formatStroopsToXlm(parseInt(inclusionFeeStroops))
  const resourceFeeXlm = formatStroopsToXlm(parseInt(resourceFeeStroops))
  const totalXlm = formatStroopsToXlm(
    parseInt(inclusionFeeStroops) + parseInt(resourceFeeStroops),
  )

  return {
    inclusionFee: inclusionFeeXlm,
    resourceFee: resourceFeeXlm,
    total: totalXlm,
  }
}

/**
 * Simulates a transaction and estimates fees in one call
 * Shorthand for common usage pattern
 *
 * @param tx - The transaction to simulate
 * @returns Fee estimates in XLM
 * @throws Error if simulation fails
 */
export async function estimateFee(tx: Transaction | string): Promise<FeeEstimate> {
  const simulation = await simulateTx(tx)
  return estimateFeeFromSimulation(simulation)
}

/**
 * Formats stroops to XLM with 7 decimal places
 * @param stroops - Amount in stroops
 * @returns Formatted XLM amount as string with exactly 7 decimal places
 */
function formatStroopsToXlm(stroops: number): string {
  const xlm = stroops / STROOPS_PER_XLM
  return xlm.toFixed(7)
}
