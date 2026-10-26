/**
 * apps/web/src/lib/soroban/assemble.ts
 *
 * Transaction assembly from Soroban simulation output.
 *
 * `rpc.assembleTransaction` is a pure SDK function — it merges a raw
 * transaction with the resource footprint, auth entries, and minimum resource
 * fee returned by a simulation response, producing a new `TransactionBuilder`
 * ready to be built and signed.  No network call is made.
 *
 * This module adds:
 *   - Input validation (rejects error / malformed simulation responses)
 *   - A convenience `assembleAndBuild` helper that returns a ready-to-sign
 *     `Transaction` in one call
 */

import {
  rpc as StellarRpc
} from "@stellar/stellar-sdk/minimal"
import type {
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder} from "@stellar/stellar-sdk/minimal";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AssembleResult = {
  /**
   * A `TransactionBuilder` with the simulation footprint, auth entries, and
   * resource fee applied.  Call `.build()` to obtain the final `Transaction`.
   */
  builder: TransactionBuilder
  /**
   * The minimum resource fee (in stroops) extracted from the simulation.
   * Useful for displaying fee estimates before the caller commits to signing.
   */
  minResourceFee: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a raw or parsed simulation into the parsed variant so the SDK
 * type-guards (`isSimulationError`, `isSimulationRestore`) work correctly.
 */
function ensureParsed(
  simulation:
    | StellarRpc.Api.SimulateTransactionResponse
    | StellarRpc.Api.RawSimulateTransactionResponse,
): StellarRpc.Api.SimulateTransactionResponse {
  if (StellarRpc.Api.isSimulationRaw(simulation)) {
    return StellarRpc.parseRawSimulation(simulation)
  }
  return simulation
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assemble a transaction from a successful simulation response.
 *
 * Returns a `TransactionBuilder` with the Soroban resource footprint and
 * auth entries applied.  Throws for error, malformed, or restore-required
 * simulation responses so the caller always receives a usable builder.
 *
 * @example
 * const simulation = await sorobanRpc.simulateTransaction(tx)
 * const { builder, minResourceFee } = assembleTx(tx, simulation)
 * const assembled = builder.build()
 * // assembled is ready to sign
 *
 * @param raw        The original unsigned transaction
 * @param simulation The simulation response from `sorobanRpc.simulateTransaction`
 * @throws {Error} when the simulation is an error response
 * @throws {Error} when the simulation requires ledger entry restoration
 */
export function assembleTx(
  raw: Transaction | FeeBumpTransaction,
  simulation:
    | StellarRpc.Api.SimulateTransactionResponse
    | StellarRpc.Api.RawSimulateTransactionResponse,
): AssembleResult {
  const parsed = ensureParsed(simulation)

  if (StellarRpc.Api.isSimulationError(parsed)) {
    throw new Error(`Simulation failed — cannot assemble transaction: ${parsed.error}`)
  }

  if (StellarRpc.Api.isSimulationRestore(parsed)) {
    throw new Error(
      "Simulation requires ledger entry restoration before this transaction can be assembled",
    )
  }

  // Extract minResourceFee — present on success and restore responses.
  const minResourceFee: string = parsed.minResourceFee

  const builder = StellarRpc.assembleTransaction(raw, simulation)

  return { builder, minResourceFee }
}

/**
 * Assemble and immediately build a transaction from a simulation response.
 *
 * Convenience wrapper around `assembleTx` that calls `.build()` for you.
 *
 * @returns A fully assembled, unsigned `Transaction` ready to be signed.
 */
export function assembleAndBuild(
  raw: Transaction | FeeBumpTransaction,
  simulation:
    | StellarRpc.Api.SimulateTransactionResponse
    | StellarRpc.Api.RawSimulateTransactionResponse,
): Transaction {
  const { builder } = assembleTx(raw, simulation)
  return builder.build()
}
