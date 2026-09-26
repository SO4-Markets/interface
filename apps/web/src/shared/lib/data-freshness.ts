/**
 * Data freshness and post-transaction refresh contracts for order book.
 *
 * Defines data sources, timestamps, stale thresholds, and invalidation targets
 * for market data and account mutations.
 */

export type DataSource = 'ledger' | 'indexer' | 'websocket' | 'oracle'

export type DataFreshnessLevel = 'critical' | 'high' | 'normal' | 'low'

/**
 * Action that mutates account or market state.
 */
export type TransactionAction = 'create' | 'cancel' | 'fill' | 'close' | 'collateral' | 'funding' | 'transfer'

/**
 * Data entity that may be affected by transactions.
 */
export type DataEntity = 'balances' | 'orders' | 'positions' | 'history' | 'marketTotals'

/**
 * Configuration for a single data stream.
 */
export type DataStreamConfig = {
  source: DataSource
  staleness: {
    // Time in milliseconds before data is considered stale
    thresholdMs: number
    // Action taken when threshold exceeded
    onStale: 'retry' | 'notify' | 'degrade'
  }
  // Time required for ledger confirmation (separate from request completion)
  ledgerConfirmationMs?: number
  // Time required for indexer catch-up after ledger confirmation
  indexerCatchUpMs?: number
}

/**
 * Refresh target after a transaction.
 * Maps actions to the entities that must be refreshed.
 */
export type RefreshMatrix = Record<TransactionAction, Array<DataEntity>>

/**
 * Source-to-screen and confirmation-to-refresh targets.
 */
export type RefreshTarget = {
  // Time from data source emission to screen update
  sourceToScreen: {
    p50Ms: number
    p95Ms: number
    p99Ms: number
  }
  // Time from transaction confirmation to refresh visible
  confirmationToRefresh: {
    p50Ms: number
    p95Ms: number
    p99Ms: number
  }
  // Visible behavior when provider misses targets
  fallbackBehavior: 'skeleton' | 'staleIndicator' | 'spinner' | 'none'
}

/**
 * Complete data freshness contract for the order book.
 */
export type DataFreshnessContract = {
  // Timestamp of contract definition
  definedAt: Date

  // Data streams configuration
  streams: Record<DataEntity, DataStreamConfig>

  // Transaction action to entity refresh mapping
  refreshMatrix: RefreshMatrix

  // Measurable targets
  targets: Record<DataEntity, RefreshTarget>

  // Source-specific catch-up conditions
  catchUp: {
    // Ledger cursor must reach transaction ledger
    ledgerCursorReady: boolean
    // Indexer must catch up after ledger confirmation
    indexerCatchUp: boolean
    // Request completion not tied to data availability
    requestCompletionIndependent: boolean
  }
}

/**
 * Default refresh matrix: which entities to refresh after each action.
 */
export const DEFAULT_REFRESH_MATRIX: RefreshMatrix = {
  create: ['orders', 'balances', 'positions', 'history', 'marketTotals'],
  cancel: ['orders', 'history'],
  fill: ['orders', 'positions', 'balances', 'history', 'marketTotals'],
  close: ['positions', 'balances', 'history', 'marketTotals'],
  collateral: ['balances', 'positions'],
  funding: ['positions', 'balances', 'history'],
  transfer: ['balances', 'history'],
}

/**
 * Default data stream configurations.
 */
export const DEFAULT_STREAM_CONFIGS: Record<DataEntity, DataStreamConfig> = {
  balances: {
    source: 'ledger',
    staleness: {
      thresholdMs: 5000,
      onStale: 'retry',
    },
    ledgerConfirmationMs: 1000,
    indexerCatchUpMs: 2000,
  },
  orders: {
    source: 'indexer',
    staleness: {
      thresholdMs: 3000,
      onStale: 'notify',
    },
    indexerCatchUpMs: 2000,
  },
  positions: {
    source: 'indexer',
    staleness: {
      thresholdMs: 5000,
      onStale: 'retry',
    },
    ledgerConfirmationMs: 1000,
    indexerCatchUpMs: 2000,
  },
  history: {
    source: 'indexer',
    staleness: {
      thresholdMs: 10000,
      onStale: 'degrade',
    },
    indexerCatchUpMs: 3000,
  },
  marketTotals: {
    source: 'websocket',
    staleness: {
      thresholdMs: 2000,
      onStale: 'notify',
    },
  },
}

/**
 * Default refresh targets (p50/p95/p99 latencies).
 */
export const DEFAULT_REFRESH_TARGETS: Record<DataEntity, RefreshTarget> = {
  balances: {
    sourceToScreen: {
      p50Ms: 500,
      p95Ms: 1500,
      p99Ms: 3000,
    },
    confirmationToRefresh: {
      p50Ms: 1000,
      p95Ms: 2500,
      p99Ms: 5000,
    },
    fallbackBehavior: 'skeleton',
  },
  orders: {
    sourceToScreen: {
      p50Ms: 300,
      p95Ms: 1000,
      p99Ms: 2000,
    },
    confirmationToRefresh: {
      p50Ms: 800,
      p95Ms: 2000,
      p99Ms: 4000,
    },
    fallbackBehavior: 'staleIndicator',
  },
  positions: {
    sourceToScreen: {
      p50Ms: 500,
      p95Ms: 1500,
      p99Ms: 3000,
    },
    confirmationToRefresh: {
      p50Ms: 1000,
      p95Ms: 2500,
      p99Ms: 5000,
    },
    fallbackBehavior: 'skeleton',
  },
  history: {
    sourceToScreen: {
      p50Ms: 1000,
      p95Ms: 3000,
      p99Ms: 5000,
    },
    confirmationToRefresh: {
      p50Ms: 2000,
      p95Ms: 4000,
      p99Ms: 8000,
    },
    fallbackBehavior: 'spinner',
  },
  marketTotals: {
    sourceToScreen: {
      p50Ms: 100,
      p95Ms: 500,
      p99Ms: 1000,
    },
    confirmationToRefresh: {
      p50Ms: 200,
      p95Ms: 1000,
      p99Ms: 2000,
    },
    fallbackBehavior: 'none',
  },
}

/**
 * Creates a default data freshness contract.
 */
export function createDefaultFreshnessContract(): DataFreshnessContract {
  return {
    definedAt: new Date(),
    streams: DEFAULT_STREAM_CONFIGS,
    refreshMatrix: DEFAULT_REFRESH_MATRIX,
    targets: DEFAULT_REFRESH_TARGETS,
    catchUp: {
      ledgerCursorReady: true,
      indexerCatchUp: true,
      requestCompletionIndependent: true,
    },
  }
}

/**
 * Check if a data entity is stale based on its config and last update time.
 */
export function isDataStale(
  entity: DataEntity,
  lastUpdateMs: number,
  contract: DataFreshnessContract,
): boolean {
  const config = contract.streams[entity]
  const ageMs = Date.now() - lastUpdateMs
  return ageMs > config.staleness.thresholdMs
}

/**
 * Get all entities that need refresh after a transaction action.
 */
export function getEntitiesToRefresh(
  action: TransactionAction,
  contract: DataFreshnessContract,
): Array<DataEntity> {
  return contract.refreshMatrix[action]
}

/**
 * Get the fallback behavior for a stale entity.
 */
export function getFallbackBehavior(
  entity: DataEntity,
  contract: DataFreshnessContract,
): 'skeleton' | 'staleIndicator' | 'spinner' | 'none' {
  return contract.targets[entity].fallbackBehavior
}
