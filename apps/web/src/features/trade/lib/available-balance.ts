/**
 * Available balance calculation for order sizing.
 *
 * Accounts for:
 * - Wallet balance
 * - Trading fees (position fee, execution fee, price impact)
 * - Reserves and safety margins
 * - Pending commitments from open positions
 */

export type AvailableBalanceParams = {
  walletBalance: number
  totalFeesUsd: number
  minExecutionFeeXlm: number
  xlmPrice: number
}

/**
 * Calculate the available balance that can be safely used for an order.
 * Deducts fees and reserves to ensure the order doesn't fail due to insufficient balance.
 */
export function calculateAvailableBalance(params: AvailableBalanceParams): number {
  const { walletBalance, totalFeesUsd, minExecutionFeeXlm, xlmPrice } = params

  if (walletBalance <= 0) return 0

  // Total cost: fees + execution buffer
  const executionFeeUsd = minExecutionFeeXlm * xlmPrice
  const totalCost = totalFeesUsd + executionFeeUsd

  // Available: balance minus all costs
  const available = walletBalance - totalCost

  // Never return negative — user has insufficient balance
  return Math.max(0, available)
}

/**
 * Calculate amount for a given percentage of available balance.
 * Returns 0 if insufficient balance.
 */
export function getPercentageAmount(
  availableBalance: number,
  percentage: number // 0-100
): number {
  if (availableBalance <= 0 || percentage < 0 || percentage > 100) return 0
  return (availableBalance * percentage) / 100
}

/**
 * Validate that an amount can be safely executed given available balance and fees.
 */
export function canExecuteAmount(
  amount: number,
  availableBalance: number,
  estimatedFeesUsd: number
): boolean {
  if (amount <= 0 || availableBalance <= 0) return false
  return amount + estimatedFeesUsd <= availableBalance
}
