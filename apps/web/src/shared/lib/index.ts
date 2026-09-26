/**
 * Order book specifications and models.
 *
 * Exports:
 * - Market identity and capability model (OB-003)
 * - Data freshness and refresh contracts (OB-005)
 * - Workspace layout specifications (OB-001)
 */

export {
  validateMarketIdentity,
  canPerformAction,
  getMarketCollisionKey,
  type AssetPrecision,
  type MarketPrecision,
  type SupportedAction,
  type MarketCapabilities,
  type Network,
  type Venue,
  type MarketIdentity,
} from './market-identity'

export {
  createDefaultFreshnessContract,
  isDataStale,
  getEntitiesToRefresh,
  getFallbackBehavior,
  DEFAULT_REFRESH_MATRIX,
  DEFAULT_STREAM_CONFIGS,
  DEFAULT_REFRESH_TARGETS,
  type DataSource,
  type DataFreshnessLevel,
  type TransactionAction,
  type DataEntity,
  type DataStreamConfig,
  type RefreshMatrix,
  type RefreshTarget,
  type DataFreshnessContract,
} from './data-freshness'

export {
  getWorkspaceLayout,
  getPanel,
  supportsOrderType,
  DESKTOP_LAYOUT,
  TABLET_LAYOUT,
  MOBILE_LAYOUT,
  type Viewport,
  type PanelId,
  type ControlType,
  type ControlAction,
  type LoadingState,
  type PanelControl,
  type WorkspacePanel,
  type WorkspaceLayout,
  type OrderType,
} from './orderbook-layout'
