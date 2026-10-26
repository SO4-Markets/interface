import { rpc } from "@stellar/stellar-sdk/minimal"

const RPC_URL = import.meta.env.VITE_RPC_URL

if (!RPC_URL) {
  throw new Error("VITE_RPC_URL environment variable is not set")
}

/**
 * Singleton Soroban RPC client
 * Used throughout the application for all contract interactions.
 * Prevents multiple RPC connections and centralizes configuration.
 */
export const sorobanRpc = new rpc.Server(RPC_URL, { allowHttp: false })
