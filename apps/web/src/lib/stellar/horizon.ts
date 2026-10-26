import { Horizon } from "@stellar/stellar-sdk/minimal"

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL

if (!HORIZON_URL) {
  throw new Error("VITE_HORIZON_URL environment variable is not set")
}

/**
 * Singleton Horizon client
 * Used throughout the application for reading account data and balances.
 * Manages sequence numbers and SAC trustline information.
 */
export const horizonServer = new Horizon.Server(HORIZON_URL)
