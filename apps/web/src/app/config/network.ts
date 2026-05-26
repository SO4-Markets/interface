/**
 * apps/web/src/app/config/network.ts
 *
 * Derives the active Stellar network configuration from ENV.
 * Flip VITE_NETWORK=mainnet to switch all URLs and the network
 * passphrase in one shot.
 *
 * Usage:
 *   import { NETWORK } from "@/app/config/network"
 *   const server = new rpc.Server(NETWORK.rpcUrl)
 *   const link   = `${NETWORK.explorerBaseUrl}/tx/${hash}`
 */

import { Networks } from "@stellar/stellar-sdk"
import { ENV } from "./env"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NetworkConfig = {
  /** "testnet" | "mainnet" */
  name: "testnet" | "mainnet"
  /** Soroban JSON-RPC endpoint. */
  rpcUrl: string
  /** Horizon REST API endpoint. */
  horizonUrl: string
  /**
   * Network passphrase used when building / signing / verifying transactions.
   *   Testnet : StellarSdk.Networks.TESTNET
   *   Mainnet : StellarSdk.Networks.PUBLIC
   */
  networkPassphrase: string
  /**
   * Base URL for stellar.expert block explorer.
   * Append `/tx/<hash>`, `/account/<id>`, etc.
   *   Testnet : https://stellar.expert/explorer/testnet
   *   Mainnet : https://stellar.expert/explorer/public
   */
  explorerBaseUrl: string
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK — single active config, derived at startup
// ─────────────────────────────────────────────────────────────────────────────

export const NETWORK: NetworkConfig =
  ENV.NETWORK === "mainnet"
    ? {
        name: "mainnet",
        rpcUrl: ENV.RPC_URL,
        horizonUrl: ENV.HORIZON_URL,
        networkPassphrase: Networks.PUBLIC,
        explorerBaseUrl: "https://stellar.expert/explorer/public",
      }
    : {
        name: "testnet",
        rpcUrl: ENV.RPC_URL,
        horizonUrl: ENV.HORIZON_URL,
        networkPassphrase: Networks.TESTNET,
        explorerBaseUrl: "https://stellar.expert/explorer/testnet",
      }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a stellar.expert transaction explorer URL. */
export function explorerTxUrl(hash: string): string {
  return `${NETWORK.explorerBaseUrl}/tx/${hash}`
}

/** Build a stellar.expert account explorer URL. */
export function explorerAccountUrl(address: string): string {
  return `${NETWORK.explorerBaseUrl}/account/${address}`
}
