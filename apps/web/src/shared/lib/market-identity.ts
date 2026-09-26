/**
 * Market identity and capability model for order book.
 *
 * Defines network, venue, market ID, assets, precision, and supported actions.
 * Ensures that two markets sharing a display symbol cannot collide across
 * network, collateral, or venue.
 */

export type AssetPrecision = {
  decimals: number
  displayDecimals: number
}

export type MarketPrecision = {
  base: AssetPrecision
  quote: AssetPrecision
  tick: number
  lot: number
  minimumNotional: number
}

export type SupportedAction = 'create' | 'cancel' | 'fill' | 'close' | 'collateral' | 'funding' | 'transfer'

export type MarketCapabilities = {
  supportedActions: Array<SupportedAction>
  isDisabled: boolean
  liquidationEnabled: boolean
  fundingRateEnabled: boolean
}

export type Network = 'mainnet' | 'testnet' | 'local'

export type Venue = 'soroban' | 'classic'

export type MarketIdentity = {
  // Network and venue context
  network: Network
  venue: Venue

  // Market identifiers
  marketId: string
  displaySymbol: string

  // Contract identifiers (distinct from display)
  contractId: string
  baseAssetContractId: string
  quoteAssetContractId: string

  // Base and quote asset details
  baseAsset: {
    contractId: string
    symbol: string
    name: string
    issuerId?: string
  }

  quoteAsset: {
    contractId: string
    symbol: string
    name: string
    issuerId?: string
  }

  // Precision configuration
  precision: MarketPrecision

  // Market capabilities
  capabilities: MarketCapabilities

  // Optional metadata
  collateral?: {
    required: boolean
    type: 'baseToken' | 'quoteToken' | 'both'
  }

  tags?: Array<string>
}

/**
 * Validates market identity constraints:
 * - No collision across network, venue, or collateral type
 * - Valid precision configuration
 * - Required capabilities defined
 */
export function validateMarketIdentity(market: MarketIdentity): {
  valid: boolean
  errors: Array<string>
} {
  const errors: Array<string> = []

  // Validate precision
  if (market.precision.tick <= 0) {
    errors.push('Tick size must be positive')
  }

  if (market.precision.lot <= 0) {
    errors.push('Lot size must be positive')
  }

  if (market.precision.minimumNotional <= 0) {
    errors.push('Minimum notional must be positive')
  }

  if (market.precision.base.decimals < 0 || market.precision.base.decimals > 19) {
    errors.push('Base asset decimals must be between 0 and 19')
  }

  if (market.precision.quote.decimals < 0 || market.precision.quote.decimals > 19) {
    errors.push('Quote asset decimals must be between 0 and 19')
  }

  if (market.precision.base.displayDecimals < 0 || market.precision.base.displayDecimals > market.precision.base.decimals) {
    errors.push('Base asset displayDecimals must be between 0 and decimals')
  }

  if (market.precision.quote.displayDecimals < 0 || market.precision.quote.displayDecimals > market.precision.quote.decimals) {
    errors.push('Quote asset displayDecimals must be between 0 and decimals')
  }

  // Validate capabilities
  if (market.capabilities.supportedActions.length === 0) {
    errors.push('At least one supported action must be defined')
  }

  // Validate asset contract IDs are set
  if (!market.baseAssetContractId || !market.baseAssetContractId.trim()) {
    errors.push('Base asset contract ID is required')
  }

  if (!market.quoteAssetContractId || !market.quoteAssetContractId.trim()) {
    errors.push('Quote asset contract ID is required')
  }

  // Validate market contract ID
  if (!market.contractId || !market.contractId.trim()) {
    errors.push('Market contract ID is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if a market can perform a specific action.
 */
export function canPerformAction(market: MarketIdentity, action: SupportedAction): boolean {
  return !market.capabilities.isDisabled && market.capabilities.supportedActions.includes(action)
}

/**
 * Get the collision key for a market identity.
 * Two markets with the same collision key should not exist.
 */
export function getMarketCollisionKey(market: MarketIdentity): string {
  return `${market.network}:${market.venue}:${market.baseAsset.contractId}:${market.quoteAsset.contractId}:${market.collateral?.type || 'none'}`
}
