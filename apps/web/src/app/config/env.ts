/**
 * apps/web/src/app/config/env.ts
 *
 * Single source of truth for every VITE_ environment variable.
 * Evaluated at module-load time — a missing required var throws
 * "Missing env var: VITE_X" before any component renders, so
 * mis-configured deployments fail loudly.
 *
 * Usage:
 *   import { ENV } from "@/app/config/env"
 *   console.log(ENV.NETWORK)          // "testnet" | "mainnet"
 *   console.log(ENV.RPC_URL)          // Soroban RPC endpoint
 *   console.log(ENV.CONTRACTS.DATA_STORE) // contract address
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Assert a required env var is set, throw with a clear message if not. */
function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

/** Return an optional env var or a hard-coded fallback. */
function optionalEnv(value: string | undefined, fallback: string): string {
  return value ?? fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Network = "testnet" | "mainnet"

export type EnvContracts = {
  EXCHANGE_ROUTER: string
  SYNTHETICS_READER: string
  DATA_STORE: string
  ORDER_VAULT: string
  STAKING_ROUTER: string
  GLV_ROUTER: string
  VESTING_ROUTER: string
  REFERRAL_STORAGE: string
}

export type Env = {
  /** Active Stellar network. */
  NETWORK: Network
  /** Soroban JSON-RPC endpoint (see https://developers.stellar.org/docs/data/apis/rpc/providers). */
  RPC_URL: string
  /** Horizon REST API endpoint. */
  HORIZON_URL: string
  /** Oracle / price-feed base URL. Falls back to GMX infra if unset. */
  ORACLE_URL: string
  /** Soroban contract addresses, keyed by role. */
  CONTRACTS: EnvContracts
}

// ─────────────────────────────────────────────────────────────────────────────
// ENV — evaluated once at startup
// ─────────────────────────────────────────────────────────────────────────────
//
// Each `import.meta.env.VITE_*` reference is inlined by Vite at build time.
// Do NOT use `import.meta.env[variable]` (dynamic key) — Vite cannot statically
// analyse it and the values would be undefined at runtime.

export const ENV: Env = {
  NETWORK: requireEnv(import.meta.env.VITE_NETWORK, "VITE_NETWORK") as Network,

  RPC_URL: requireEnv(import.meta.env.VITE_RPC_URL, "VITE_RPC_URL"),

  HORIZON_URL: requireEnv(import.meta.env.VITE_HORIZON_URL, "VITE_HORIZON_URL"),

  ORACLE_URL: optionalEnv(
    import.meta.env.VITE_ORACLE_URL,
    "https://arbitrum-api.gmxinfra.io",
  ),

  CONTRACTS: {
    EXCHANGE_ROUTER: requireEnv(
      import.meta.env.VITE_CONTRACT_EXCHANGE_ROUTER,
      "VITE_CONTRACT_EXCHANGE_ROUTER",
    ),
    SYNTHETICS_READER: requireEnv(
      import.meta.env.VITE_CONTRACT_SYNTHETICS_READER,
      "VITE_CONTRACT_SYNTHETICS_READER",
    ),
    DATA_STORE: requireEnv(
      import.meta.env.VITE_CONTRACT_DATA_STORE,
      "VITE_CONTRACT_DATA_STORE",
    ),
    ORDER_VAULT: requireEnv(
      import.meta.env.VITE_CONTRACT_ORDER_VAULT,
      "VITE_CONTRACT_ORDER_VAULT",
    ),
    STAKING_ROUTER: requireEnv(
      import.meta.env.VITE_CONTRACT_STAKING_ROUTER,
      "VITE_CONTRACT_STAKING_ROUTER",
    ),
    GLV_ROUTER: requireEnv(
      import.meta.env.VITE_CONTRACT_GLV_ROUTER,
      "VITE_CONTRACT_GLV_ROUTER",
    ),
    VESTING_ROUTER: requireEnv(
      import.meta.env.VITE_CONTRACT_VESTING_ROUTER,
      "VITE_CONTRACT_VESTING_ROUTER",
    ),
    REFERRAL_STORAGE: requireEnv(
      import.meta.env.VITE_CONTRACT_REFERRAL_STORAGE,
      "VITE_CONTRACT_REFERRAL_STORAGE",
    ),
  },
}
