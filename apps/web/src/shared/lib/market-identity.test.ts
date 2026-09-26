import { describe, expect, it } from 'vitest'
import {
  
  canPerformAction,
  getMarketCollisionKey,
  validateMarketIdentity
} from './market-identity'
import type {MarketIdentity} from './market-identity';

describe('market-identity', () => {
  const validMarket: MarketIdentity = {
    network: 'mainnet',
    venue: 'soroban',
    marketId: 'BTC-USDC-001',
    displaySymbol: 'BTC/USDC',
    contractId: 'CBT0000000000000000000000000000000000000000000000000000000000001',
    baseAssetContractId: 'CBT0000000000000000000000000000000000000000000000000000000000002',
    quoteAssetContractId: 'CBT0000000000000000000000000000000000000000000000000000000000003',
    baseAsset: {
      contractId: 'CBT0000000000000000000000000000000000000000000000000000000000002',
      symbol: 'BTC',
      name: 'Bitcoin',
    },
    quoteAsset: {
      contractId: 'CBT0000000000000000000000000000000000000000000000000000000000003',
      symbol: 'USDC',
      name: 'USD Coin',
    },
    precision: {
      base: {
        decimals: 7,
        displayDecimals: 4,
      },
      quote: {
        decimals: 6,
        displayDecimals: 2,
      },
      tick: 100,
      lot: 1000,
      minimumNotional: 50000000,
    },
    capabilities: {
      supportedActions: ['create', 'cancel', 'fill', 'close'],
      isDisabled: false,
      liquidationEnabled: true,
      fundingRateEnabled: true,
    },
  }

  describe('validateMarketIdentity', () => {
    it('accepts valid market identity', () => {
      const result = validateMarketIdentity(validMarket)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects negative tick size', () => {
      const invalid = {
        ...validMarket,
        precision: { ...validMarket.precision, tick: -1 },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Tick size must be positive')
    })

    it('rejects negative lot size', () => {
      const invalid = {
        ...validMarket,
        precision: { ...validMarket.precision, lot: 0 },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Lot size must be positive')
    })

    it('rejects negative minimum notional', () => {
      const invalid = {
        ...validMarket,
        precision: { ...validMarket.precision, minimumNotional: -1 },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Minimum notional must be positive')
    })

    it('rejects invalid decimals', () => {
      const invalid = {
        ...validMarket,
        precision: {
          ...validMarket.precision,
          base: { ...validMarket.precision.base, decimals: 20 },
        },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Base asset decimals must be between 0 and 19')
    })

    it('rejects displayDecimals greater than decimals', () => {
      const invalid = {
        ...validMarket,
        precision: {
          ...validMarket.precision,
          base: {
            decimals: 6,
            displayDecimals: 8,
          },
        },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'Base asset displayDecimals must be between 0 and decimals',
      )
    })

    it('rejects empty supported actions', () => {
      const invalid = {
        ...validMarket,
        capabilities: {
          ...validMarket.capabilities,
          supportedActions: [],
        },
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one supported action must be defined')
    })

    it('rejects missing contract IDs', () => {
      const invalid = {
        ...validMarket,
        contractId: '',
      }
      const result = validateMarketIdentity(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Market contract ID is required')
    })
  })

  describe('canPerformAction', () => {
    it('returns true for supported action', () => {
      expect(canPerformAction(validMarket, 'create')).toBe(true)
      expect(canPerformAction(validMarket, 'cancel')).toBe(true)
    })

    it('returns false for unsupported action', () => {
      expect(canPerformAction(validMarket, 'collateral')).toBe(false)
    })

    it('returns false if market is disabled', () => {
      const disabled = {
        ...validMarket,
        capabilities: {
          ...validMarket.capabilities,
          isDisabled: true,
        },
      }
      expect(canPerformAction(disabled, 'create')).toBe(false)
    })
  })

  describe('getMarketCollisionKey', () => {
    it('generates unique key per network', () => {
      const mainnet: MarketIdentity = { ...validMarket, network: 'mainnet' }
      const testnet: MarketIdentity = { ...validMarket, network: 'testnet' }

      const keyMainnet = getMarketCollisionKey(mainnet)
      const keyTestnet = getMarketCollisionKey(testnet)

      expect(keyMainnet).not.toBe(keyTestnet)
    })

    it('generates unique key per venue', () => {
      const soroban: MarketIdentity = { ...validMarket, venue: 'soroban' }
      const classic: MarketIdentity = { ...validMarket, venue: 'classic' }

      const keySoroban = getMarketCollisionKey(soroban)
      const keyClassic = getMarketCollisionKey(classic)

      expect(keySoroban).not.toBe(keyClassic)
    })

    it('generates unique key per asset pair', () => {
      const market1 = { ...validMarket }
      const market2 = {
        ...validMarket,
        baseAsset: {
          ...validMarket.baseAsset,
          contractId: 'DIFFERENT0000000000000000000000000000000000000000000000000000000',
        },
      }

      const key1 = getMarketCollisionKey(market1)
      const key2 = getMarketCollisionKey(market2)

      expect(key1).not.toBe(key2)
    })

    it('generates unique key per collateral type', () => {
      const noneCollateral = { ...validMarket, collateral: undefined }
      const baseCollateral = {
        ...validMarket,
        collateral: { required: true, type: 'baseToken' as const },
      }

      const keyNone = getMarketCollisionKey(noneCollateral)
      const keyBase = getMarketCollisionKey(baseCollateral)

      expect(keyNone).not.toBe(keyBase)
    })
  })

  describe('fixtures', () => {
    it('handles disabled market', () => {
      const disabled = {
        ...validMarket,
        capabilities: {
          ...validMarket.capabilities,
          isDisabled: true,
        },
      }

      const result = validateMarketIdentity(disabled)
      expect(result.valid).toBe(true)
      expect(canPerformAction(disabled, 'create')).toBe(false)
    })

    it('handles market with missing optional capabilities', () => {
      const minimal: MarketIdentity = {
        ...validMarket,
        capabilities: {
          supportedActions: ['create'],
          isDisabled: false,
          liquidationEnabled: false,
          fundingRateEnabled: false,
        },
      }

      const result = validateMarketIdentity(minimal)
      expect(result.valid).toBe(true)
      expect(minimal.capabilities.supportedActions).toHaveLength(1)
    })

    it('handles market with invalid precision', () => {
      const invalidPrecision = {
        ...validMarket,
        precision: {
          base: { decimals: -1, displayDecimals: 0 },
          quote: { decimals: 6, displayDecimals: 2 },
          tick: 0,
          lot: -1,
          minimumNotional: 0,
        },
      }

      const result = validateMarketIdentity(invalidPrecision)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
