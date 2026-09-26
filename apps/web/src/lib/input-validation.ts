/**
 * Input validation for order entry: amounts, prices, and precision handling.
 *
 * Keeps editable strings separate from parsed values used to build transactions.
 */

import { parseAmount, MAX_DECIMALS } from "./amount"

export type ValidationResult = {
  isValid: boolean
  error: string | null
}

/**
 * Validate a base/quote amount (collateral, trade size, etc).
 * Checks for:
 * - Non-empty input
 * - Non-zero value
 * - Decimal precision within bounds
 * - No unsupported notation
 */
export function validateAmount(
  raw: string,
  options: { maxAmount?: number; decimals?: number } = {}
): ValidationResult {
  if (!raw || raw.trim() === "") {
    return { isValid: false, error: "Enter an amount" }
  }

  const parsed = parseAmount(raw, options)

  if (parsed.value === null) {
    return { isValid: false, error: "Enter a valid amount" }
  }

  if (parsed.value <= 0) {
    return { isValid: false, error: "Amount must be greater than zero" }
  }

  if (parsed.wasClamped) {
    return { isValid: false, error: `Amount exceeds maximum` }
  }

  return { isValid: true, error: null }
}

/**
 * Validate a limit or trigger price.
 * Checks for:
 * - Valid numeric value
 * - Positive value
 * - Decimal precision
 */
export function validatePrice(raw: string, decimals: number = MAX_DECIMALS): ValidationResult {
  if (!raw || raw.trim() === "") {
    return { isValid: false, error: "Enter a price" }
  }

  const parsed = parseAmount(raw, { decimals })

  if (parsed.value === null) {
    return { isValid: false, error: "Enter a valid price" }
  }

  if (parsed.value <= 0) {
    return { isValid: false, error: "Price must be greater than zero" }
  }

  return { isValid: true, error: null }
}

/**
 * Validate tick increment compliance (for orderbook precision).
 * Checks if the value is a valid multiple of the tick size.
 */
export function validateTick(value: number, tickSize: number): ValidationResult {
  if (!Number.isFinite(value) || !Number.isFinite(tickSize) || tickSize <= 0) {
    return { isValid: false, error: "Invalid tick validation" }
  }

  const remainder = value % tickSize
  // Allow small floating-point errors
  if (Math.abs(remainder) > tickSize * 1e-10 && Math.abs(remainder - tickSize) > tickSize * 1e-10) {
    return { isValid: false, error: `Must be a multiple of ${tickSize}` }
  }

  return { isValid: true, error: null }
}

/**
 * Validate lot size compliance (for position sizing).
 * Checks if the value is a valid multiple of the lot size.
 */
export function validateLot(value: number, lotSize: number): ValidationResult {
  if (!Number.isFinite(value) || !Number.isFinite(lotSize) || lotSize <= 0) {
    return { isValid: false, error: "Invalid lot validation" }
  }

  const remainder = value % lotSize
  // Allow small floating-point errors
  if (Math.abs(remainder) > lotSize * 1e-10 && Math.abs(remainder - lotSize) > lotSize * 1e-10) {
    return { isValid: false, error: `Must be a multiple of ${lotSize}` }
  }

  return { isValid: true, error: null }
}

/**
 * Validate minimum notional value (minimum trade size in USD).
 */
export function validateMinNotional(valueUsd: number, minNotional: number): ValidationResult {
  if (valueUsd < minNotional) {
    return {
      isValid: false,
      error: `Minimum trade size is $${minNotional.toLocaleString()}`,
    }
  }

  return { isValid: true, error: null }
}

/**
 * Validate balance sufficiency.
 */
export function validateBalance(amount: number, balance: number | undefined): ValidationResult {
  if (balance === undefined) {
    return { isValid: false, error: "Balance not available" }
  }

  if (amount > balance) {
    return { isValid: false, error: "Insufficient balance" }
  }

  return { isValid: true, error: null }
}
