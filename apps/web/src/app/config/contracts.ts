/**
 * apps/web/src/app/config/contracts.ts
 *
 * All Soroban contract addresses in one place, keyed by role.
 * Values are read from ENV (which in turn reads VITE_ env vars).
 *
 * Rule: feature code MUST import addresses from CONTRACTS, never
 * directly from ENV or import.meta.env.  This keeps the magic-string
 * surface area to exactly one file.
 *
 * Usage:
 *   import { CONTRACTS } from "@/app/config/contracts"
 *   contract.call("createOrder", CONTRACTS.exchangeRouter, ...)
 */

import { ENV } from "./env"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContractAddresses = {
  /** ExchangeRouter — createOrder / cancelOrder / multicall */
  exchangeRouter: string
  /** SyntheticsReader — batched market / position / order queries */
  syntheticsReader: string
  /** DataStore — on-chain key-value configuration store */
  dataStore: string
  /** OrderVault — holds collateral between order creation and execution */
  orderVault: string

  stakingRouter: string
  /** GlvRouter — GLV vault deposits and withdrawals */
  glvRouter: string
  /** VestingRouter — lock esSO4 for 12-month linear vesting */
  vestingRouter: string
  /** ReferralStorage — register / query referral codes */
  referralStorage: string
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTS — single source of truth, evaluated at startup
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRACTS: ContractAddresses = {
  exchangeRouter:   ENV.CONTRACTS.EXCHANGE_ROUTER,
  syntheticsReader: ENV.CONTRACTS.SYNTHETICS_READER,
  dataStore:        ENV.CONTRACTS.DATA_STORE,
  orderVault:       ENV.CONTRACTS.ORDER_VAULT,
  stakingRouter:    ENV.CONTRACTS.STAKING_ROUTER,
  glvRouter:        ENV.CONTRACTS.GLV_ROUTER,
  vestingRouter:    ENV.CONTRACTS.VESTING_ROUTER,
  referralStorage:  ENV.CONTRACTS.REFERRAL_STORAGE,
}
