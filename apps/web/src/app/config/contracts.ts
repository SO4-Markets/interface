/**
 * apps/web/src/app/config/contracts.ts
 *
 * All Soroban contract addresses in one place, keyed by role.
 * Values are read from ENV (which in turn reads VITE_ env vars).
 *
 * Rule: feature code MUST import addresses from CONTRACTS, never
 * directly from ENV or import.meta.env.
 *
 * Optional contracts (stakingRouter, glvRouter, vestingRouter) will be
 * an empty string when not yet deployed.  Code that uses them must guard:
 *   if (!CONTRACTS.stakingRouter) throw new Error("Staking not deployed")
 */

import { ENV } from "./env"

export type ContractAddresses = {
  // ── Core trading contracts ─────────────────────────────────────────────────
  exchangeRouter: string
  syntheticsReader: string
  dataStore: string
  orderVault: string
  referralStorage: string
  // ── Infrastructure contracts used by Reader view functions ────────────────
  oracle: string
  orderHandler: string
  // ── Optional — empty string when not deployed ─────────────────────────────
  stakingRouter: string
  glvRouter: string
  vestingRouter: string
}

export const CONTRACTS: ContractAddresses = {
  exchangeRouter:   ENV.CONTRACTS.EXCHANGE_ROUTER,
  syntheticsReader: ENV.CONTRACTS.SYNTHETICS_READER,
  dataStore:        ENV.CONTRACTS.DATA_STORE,
  orderVault:       ENV.CONTRACTS.ORDER_VAULT,
  referralStorage:  ENV.CONTRACTS.REFERRAL_STORAGE,
  oracle:           ENV.CONTRACTS.ORACLE,
  orderHandler:     ENV.CONTRACTS.ORDER_HANDLER,
  stakingRouter:    ENV.CONTRACTS.STAKING_ROUTER,
  glvRouter:        ENV.CONTRACTS.GLV_ROUTER,
  vestingRouter:    ENV.CONTRACTS.VESTING_ROUTER,
}
