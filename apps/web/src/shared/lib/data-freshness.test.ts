import { beforeEach, describe, expect, it } from 'vitest'
import {
  
  createDefaultFreshnessContract,
  getEntitiesToRefresh,
  getFallbackBehavior,
  isDataStale
} from './data-freshness'
import type {DataFreshnessContract} from './data-freshness';

describe('data-freshness', () => {
  let contract: DataFreshnessContract

  beforeEach(() => {
    contract = createDefaultFreshnessContract()
  })

  describe('createDefaultFreshnessContract', () => {
    it('creates contract with all required fields', () => {
      expect(contract.streams).toBeDefined()
      expect(contract.refreshMatrix).toBeDefined()
      expect(contract.targets).toBeDefined()
      expect(contract.catchUp).toBeDefined()
    })

    it('defines streams for all entities', () => {
      expect(contract.streams.balances).toBeDefined()
      expect(contract.streams.orders).toBeDefined()
      expect(contract.streams.positions).toBeDefined()
      expect(contract.streams.history).toBeDefined()
      expect(contract.streams.marketTotals).toBeDefined()
    })

    it('defines refresh matrix for all actions', () => {
      expect(contract.refreshMatrix.create).toBeDefined()
      expect(contract.refreshMatrix.cancel).toBeDefined()
      expect(contract.refreshMatrix.fill).toBeDefined()
      expect(contract.refreshMatrix.close).toBeDefined()
      expect(contract.refreshMatrix.collateral).toBeDefined()
      expect(contract.refreshMatrix.funding).toBeDefined()
      expect(contract.refreshMatrix.transfer).toBeDefined()
    })

    it('defines targets for all entities', () => {
      expect(contract.targets.balances).toBeDefined()
      expect(contract.targets.orders).toBeDefined()
      expect(contract.targets.positions).toBeDefined()
      expect(contract.targets.history).toBeDefined()
      expect(contract.targets.marketTotals).toBeDefined()
    })
  })

  describe('isDataStale', () => {
    it('returns false for fresh data', () => {
      const now = Date.now()
      expect(isDataStale('balances', now, contract)).toBe(false)
    })

    it('returns true for stale data', () => {
      const staleTime = Date.now() - 10000
      expect(isDataStale('balances', staleTime, contract)).toBe(true)
    })

    it('respects different staleness thresholds', () => {
      const time = Date.now() - 4000
      expect(isDataStale('balances', time, contract)).toBe(false)
      expect(isDataStale('marketTotals', time, contract)).toBe(true)
    })

    it('returns true for missing entity config', () => {
      expect(
        isDataStale('nonexistent' as any, Date.now(), contract),
      ).toBe(true)
    })
  })

  describe('getEntitiesToRefresh', () => {
    it('returns correct entities for create action', () => {
      const entities = getEntitiesToRefresh('create', contract)
      expect(entities).toContain('orders')
      expect(entities).toContain('balances')
      expect(entities).toContain('positions')
      expect(entities).toContain('history')
      expect(entities).toContain('marketTotals')
    })

    it('returns correct entities for cancel action', () => {
      const entities = getEntitiesToRefresh('cancel', contract)
      expect(entities).toContain('orders')
      expect(entities).toContain('history')
      expect(entities).not.toContain('balances')
    })

    it('returns correct entities for fill action', () => {
      const entities = getEntitiesToRefresh('fill', contract)
      expect(entities).toContain('orders')
      expect(entities).toContain('positions')
      expect(entities).toContain('balances')
      expect(entities).toContain('history')
      expect(entities).toContain('marketTotals')
    })

    it('returns correct entities for close action', () => {
      const entities = getEntitiesToRefresh('close', contract)
      expect(entities).toContain('positions')
      expect(entities).toContain('balances')
      expect(entities).toContain('history')
      expect(entities).toContain('marketTotals')
    })

    it('returns correct entities for collateral action', () => {
      const entities = getEntitiesToRefresh('collateral', contract)
      expect(entities).toContain('balances')
      expect(entities).toContain('positions')
      expect(entities).not.toContain('orders')
    })

    it('returns correct entities for funding action', () => {
      const entities = getEntitiesToRefresh('funding', contract)
      expect(entities).toContain('positions')
      expect(entities).toContain('balances')
      expect(entities).toContain('history')
    })

    it('returns correct entities for transfer action', () => {
      const entities = getEntitiesToRefresh('transfer', contract)
      expect(entities).toContain('balances')
      expect(entities).toContain('history')
      expect(entities).not.toContain('orders')
    })

    it('returns empty array for unknown action', () => {
      const entities = getEntitiesToRefresh('unknown' as any, contract)
      expect(entities).toEqual([])
    })
  })

  describe('getFallbackBehavior', () => {
    it('returns skeleton for balances', () => {
      expect(getFallbackBehavior('balances', contract)).toBe('skeleton')
    })

    it('returns staleIndicator for orders', () => {
      expect(getFallbackBehavior('orders', contract)).toBe('staleIndicator')
    })

    it('returns skeleton for positions', () => {
      expect(getFallbackBehavior('positions', contract)).toBe('skeleton')
    })

    it('returns spinner for history', () => {
      expect(getFallbackBehavior('history', contract)).toBe('spinner')
    })

    it('returns none for marketTotals', () => {
      expect(getFallbackBehavior('marketTotals', contract)).toBe('none')
    })

    it('returns none for unknown entity', () => {
      expect(getFallbackBehavior('unknown' as any, contract)).toBe('none')
    })
  })

  describe('refresh targets', () => {
    it('defines p50, p95, p99 for sourceToScreen', () => {
      const target = contract.targets.balances
      expect(target.sourceToScreen.p50Ms).toBeGreaterThan(0)
      expect(target.sourceToScreen.p95Ms).toBeGreaterThanOrEqual(target.sourceToScreen.p50Ms)
      expect(target.sourceToScreen.p99Ms).toBeGreaterThanOrEqual(target.sourceToScreen.p95Ms)
    })

    it('defines p50, p95, p99 for confirmationToRefresh', () => {
      const target = contract.targets.orders
      expect(target.confirmationToRefresh.p50Ms).toBeGreaterThan(0)
      expect(target.confirmationToRefresh.p95Ms).toBeGreaterThanOrEqual(target.confirmationToRefresh.p50Ms)
      expect(target.confirmationToRefresh.p99Ms).toBeGreaterThanOrEqual(target.confirmationToRefresh.p95Ms)
    })

    it('has reasonable latency expectations', () => {
      Object.entries(contract.targets).forEach(([, target]) => {
        expect(target.sourceToScreen.p99Ms).toBeLessThan(10000)
        expect(target.confirmationToRefresh.p99Ms).toBeLessThan(10000)
      })
    })
  })

  describe('catch-up conditions', () => {
    it('defines ledger cursor ready requirement', () => {
      expect(contract.catchUp.ledgerCursorReady).toBeDefined()
    })

    it('defines indexer catch-up requirement', () => {
      expect(contract.catchUp.indexerCatchUp).toBeDefined()
    })

    it('defines request completion independence', () => {
      expect(contract.catchUp.requestCompletionIndependent).toBeDefined()
    })
  })

  describe('stream configurations', () => {
    it('defines staleness threshold for each stream', () => {
      Object.entries(contract.streams).forEach(([, config]) => {
        expect(config.staleness.thresholdMs).toBeGreaterThan(0)
      })
    })

    it('defines stale action for each stream', () => {
      Object.entries(contract.streams).forEach(([, config]) => {
        expect(['retry', 'notify', 'degrade']).toContain(config.staleness.onStale)
      })
    })

    it('defines ledger confirmation for critical paths', () => {
      expect(contract.streams.balances.ledgerConfirmationMs).toBeGreaterThan(0)
      expect(contract.streams.positions.ledgerConfirmationMs).toBeGreaterThan(0)
    })

    it('defines indexer catch-up for indexer sources', () => {
      expect(contract.streams.orders.indexerCatchUpMs).toBeGreaterThan(0)
      expect(contract.streams.positions.indexerCatchUpMs).toBeGreaterThan(0)
    })
  })
})
