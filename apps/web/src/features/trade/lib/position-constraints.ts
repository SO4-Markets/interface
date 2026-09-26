/**
 * apps/web/src/features/trade/lib/position-constraints.ts
 *
 * Product constraints for close-position and collateral changes (OB-086).
 *
 * These rules are pure so the dialog can validate while the trader types *and*
 * the submission path can re-validate against fresh account state immediately
 * before signing. A dialog validated against a stale row is how a partial
 * close silently becomes a full close, or a collateral withdrawal pushes the
 * position past the leverage cap.
 */

import type { Position } from "../hooks/usePositions"

/** Protocol leverage cap for a position. */
export const MAX_POSITION_LEVERAGE = 50

/**
 * The subset of position state a constraint check needs.
 *
 * Kept structural (rather than `Position` itself) so the same rules can run
 * against a fresh on-chain read, whose shape is not a `Position`.
 */
export type PositionConstraintState = {
  sizeUsd: number
  sizeInUsdRaw: bigint
  collateralAmount: number
  collateralUsd: number
  markPrice: number
}

/** Adapt a UI position row to the constraint input. */
export function toConstraintState(position: Position): PositionConstraintState {
  return {
    sizeUsd: position.sizeUsd,
    sizeInUsdRaw: position.sizeInUsdRaw,
    collateralAmount: position.collateralAmount,
    collateralUsd: position.collateralUsd,
    markPrice: position.markPrice,
  }
}

export type CloseConstraintPayload = {
  isFull: boolean
  sizeDeltaUsd: number
}

export type CollateralChangeInput = {
  mode: "add" | "remove"
  /** Amount in collateral token units. */
  amount: number
  /** Collateral token price in USD. */
  tokenPriceUsd: number
  /** Wallet balance in collateral token units (add mode only). */
  walletBalance?: number
}

/** Fixed-point precision used when converting a USD delta into raw units. */
const RAW_SCALE = 1_000_000_000n

/**
 * Validate a close request against *current* position state.
 * Returns a human-readable error, or null when the request is valid.
 */
export function validateClosePayload(
  payload: CloseConstraintPayload,
  position: PositionConstraintState,
): string | null {
  if (position.sizeUsd <= 0) {
    return "Position is already closed"
  }
  if (!Number.isFinite(position.markPrice) || position.markPrice <= 0) {
    return "Mark price unavailable — wait for a fresh oracle price"
  }

  if (payload.isFull) return null

  const sizeDeltaUsd = payload.sizeDeltaUsd
  if (!Number.isFinite(sizeDeltaUsd) || sizeDeltaUsd <= 0) {
    return "Enter an amount greater than 0"
  }
  // Strictly less than: closing the whole size is the full-close path, and
  // allowing equality here would let a "partial" close execute the remainder.
  if (sizeDeltaUsd >= position.sizeUsd) {
    return "Amount must be less than total position size (use Full close instead)"
  }
  return null
}

/**
 * Validate a collateral change against *current* position state.
 * Returns a human-readable error, or null when the request is valid.
 */
export function validateCollateralChange(
  input: CollateralChangeInput,
  position: PositionConstraintState,
): string | null {
  const { amount, mode, tokenPriceUsd, walletBalance } = input

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter an amount greater than 0"
  }
  if (!Number.isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
    return "Collateral price unavailable — try again shortly"
  }

  const deltaUsd = amount * tokenPriceUsd

  if (mode === "add") {
    if (walletBalance !== undefined && amount > walletBalance) {
      return "Insufficient wallet balance"
    }
    const newCollateralUsd = position.collateralUsd + deltaUsd
    const newLeverage =
      newCollateralUsd > 0 ? position.sizeUsd / newCollateralUsd : 0
    if (newLeverage > MAX_POSITION_LEVERAGE) {
      return `New leverage exceeds maximum allowed (${MAX_POSITION_LEVERAGE}x)`
    }
    return null
  }

  if (amount >= position.collateralAmount) {
    return "Cannot remove all collateral (Close position instead)"
  }
  const newCollateralUsd = Math.max(0, position.collateralUsd - deltaUsd)
  const newLeverage =
    newCollateralUsd > 0 ? position.sizeUsd / newCollateralUsd : Number.POSITIVE_INFINITY
  if (newLeverage > MAX_POSITION_LEVERAGE) {
    return `New leverage exceeds maximum allowed (${MAX_POSITION_LEVERAGE}x)`
  }
  return null
}

/**
 * Convert a partial-close USD amount into the raw on-chain size, preserving the
 * requested amount exactly instead of resubmitting the whole position.
 *
 * Returns `undefined` when the raw value cannot be derived safely, in which
 * case the caller must fall back to the plain USD amount.
 */
export function partialSizeToRaw(
  sizeDeltaUsd: number,
  position: Pick<PositionConstraintState, "sizeUsd" | "sizeInUsdRaw">,
): bigint | undefined {
  if (!Number.isFinite(sizeDeltaUsd) || sizeDeltaUsd <= 0) return undefined
  if (!Number.isFinite(position.sizeUsd) || position.sizeUsd <= 0) return undefined
  if (position.sizeUsd < sizeDeltaUsd) return undefined

  const ratio = sizeDeltaUsd / position.sizeUsd
  if (ratio >= 1) return undefined

  // Keep ~9 decimal places of the ratio in integer space so the multiplication
  // stays exact for raw values far beyond Number.MAX_SAFE_INTEGER.
  const scaledRatio = BigInt(Math.round(ratio * Number(RAW_SCALE)))
  const raw = (position.sizeInUsdRaw * scaledRatio) / RAW_SCALE
  return raw > 0n ? raw : undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Failure classification
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionFailureKind = "wallet-rejected" | "contract" | "unknown"

export type TransactionFailure = {
  kind: TransactionFailureKind
  message: string
}

const WALLET_REJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /user (declined|rejected|denied|cancell?ed)/i,
  /rejected by (the )?(user|wallet|account)/i,
  /request (was )?(rejected|denied)/i,
  /declined by user/i,
  /user cancel/i,
  /op(eration)? (was )?cancel/i,
  /signature request (rejected|denied)/i,
]

/**
 * Tell a wallet rejection apart from a contract failure.
 *
 * The distinction is user-visible: a rejection must not be reported as a
 * failed position update, and neither may be reported as a successful close.
 */
export function classifyTransactionFailure(error: unknown): TransactionFailure {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
  const message = raw.trim() || "Transaction failed"

  if (WALLET_REJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return {
      kind: "wallet-rejected",
      message: "Transaction rejected in your wallet. No changes were made.",
    }
  }

  return { kind: "contract", message }
}
