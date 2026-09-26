/**
 * Order book workspace layout specification.
 *
 * Defines annotated desktop, tablet, and mobile layouts with loading geometry.
 * Maps each visible control to SO4 behavior. Pro mode is explicitly excluded.
 */

export type Viewport = 'mobile' | 'tablet' | 'desktop'

export type PanelId =
  | 'watchlist'
  | 'marketHeader'
  | 'chart'
  | 'orderBook'
  | 'trades'
  | 'ticket'
  | 'account'
  | 'positions'
  | 'orders'

export type ControlType = 'input' | 'button' | 'select' | 'switch' | 'slider' | 'table' | 'chart'

export type ControlAction =
  | 'createOrder'
  | 'cancelOrder'
  | 'closePosition'
  | 'updateCollateral'
  | 'selectMarket'
  | 'switchOrderType'
  | 'adjustPrice'
  | 'adjustSize'
  | 'addToWatchlist'
  | 'removeFromWatchlist'

export type LoadingState = 'loading' | 'loaded' | 'error' | 'empty'

/**
 * A control within a panel with its SO4 behavior mapping.
 */
export type PanelControl = {
  id: string
  label: string
  type: ControlType
  action: ControlAction
  // Visual dimensions for loading state placeholder
  loadingGeometry?: {
    width: string
    height: string
    aspect?: number
  }
  // Whether control is visible by default
  visible: boolean
  // Whether Pro mode can customize this
  proModeCustomizable: boolean
}

/**
 * A panel in the workspace with its controls and loading behavior.
 */
export type WorkspacePanel = {
  id: PanelId
  title: string
  controls: Array<PanelControl>
  // Minimum width/height for readability
  minWidth?: string
  minHeight?: string
  // Default width/height for this viewport
  defaultWidth?: string
  defaultHeight?: string
  // Can this panel be hidden?
  hideable: boolean
  // Loading state for the panel
  loadingGeometry?: {
    // Skeleton placeholder dimensions while loading
    skeletonWidth: string
    skeletonHeight: string
  }
  // Supported order types for this panel
  supportedOrderTypes: Array<OrderType>
}

/**
 * Complete workspace layout for a specific viewport.
 */
export type WorkspaceLayout = {
  viewport: Viewport
  panels: Array<WorkspacePanel>
  // Panel arrangement (grid, flex, absolute)
  arrangement: 'grid' | 'flex' | 'absolute'
  // How panels can be resized
  resizable: boolean
  // Whether panels can be reordered/dragged
  reorderable: boolean
  // Whether pro mode customization applies
  proModeEnabled: boolean
  // Default panel visibility order
  panelOrder: Array<PanelId>
}

export type OrderType = 'limit' | 'market' | 'stop-loss' | 'take-profit'

/**
 * Desktop layout: full-featured with all panels visible.
 *
 * Arrangement:
 * - Left: Watchlist (20%)
 * - Center-top: Market Header + Chart (80%)
 * - Center-bottom: Order Book + Trades (40% each horizontally)
 * - Right: Ticket (20%), Account tabs below
 */
export const DESKTOP_LAYOUT: WorkspaceLayout = {
  viewport: 'desktop',
  proModeEnabled: false,
  resizable: true,
  reorderable: true,
  arrangement: 'flex',
  panelOrder: ['watchlist', 'marketHeader', 'chart', 'orderBook', 'trades', 'ticket', 'account'],
  panels: [
    {
      id: 'watchlist',
      title: 'Watchlist',
      hideable: true,
      minWidth: '200px',
      defaultWidth: '20%',
      defaultHeight: '100%',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'watchlist-search',
          label: 'Search',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'watchlist-list',
          label: 'Markets',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '400px' },
        },
        {
          id: 'watchlist-add',
          label: 'Add to Watchlist',
          type: 'button',
          action: 'addToWatchlist',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '500px',
      },
    },
    {
      id: 'marketHeader',
      title: 'Market Header',
      hideable: false,
      minHeight: '60px',
      defaultHeight: '60px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'market-selector',
          label: 'Market',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '200px', height: '36px' },
        },
        {
          id: 'market-price',
          label: 'Current Price',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '150px', height: '28px' },
        },
        {
          id: 'market-change24h',
          label: '24h Change',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100px', height: '28px' },
        },
        {
          id: 'market-high-low',
          label: 'High/Low',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '150px', height: '28px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '60px',
      },
    },
    {
      id: 'chart',
      title: 'Chart',
      hideable: true,
      minHeight: '300px',
      defaultHeight: '50%',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'chart-timeframe',
          label: 'Timeframe',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'chart-drawing-tools',
          label: 'Drawing Tools',
          type: 'button',
          action: 'selectMarket',
          visible: false,
          proModeCustomizable: false,
        },
        {
          id: 'chart-indicators',
          label: 'Indicators',
          type: 'button',
          action: 'selectMarket',
          visible: false,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '400px',
      },
    },
    {
      id: 'orderBook',
      title: 'Order Book',
      hideable: true,
      minHeight: '200px',
      defaultHeight: '25%',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'orderbook-depth',
          label: 'Depth Preset',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'orderbook-bids',
          label: 'Bids',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
        {
          id: 'orderbook-asks',
          label: 'Asks',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '250px',
      },
    },
    {
      id: 'trades',
      title: 'Recent Trades',
      hideable: true,
      minHeight: '200px',
      defaultHeight: '25%',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'trades-list',
          label: 'Trades',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '250px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '250px',
      },
    },
    {
      id: 'ticket',
      title: 'Order Ticket',
      hideable: false,
      minWidth: '250px',
      defaultWidth: '20%',
      defaultHeight: '50%',
      supportedOrderTypes: ['limit', 'market', 'stop-loss', 'take-profit'],
      controls: [
        {
          id: 'ticket-order-type',
          label: 'Order Type',
          type: 'select',
          action: 'switchOrderType',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-side',
          label: 'Side',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-price',
          label: 'Price',
          type: 'input',
          action: 'adjustPrice',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'ticket-size',
          label: 'Size',
          type: 'input',
          action: 'adjustSize',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'ticket-total',
          label: 'Total',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'ticket-submit',
          label: 'Create Order',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '400px',
      },
    },
    {
      id: 'account',
      title: 'Account',
      hideable: false,
      minWidth: '250px',
      defaultWidth: '20%',
      defaultHeight: '50%',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'account-balances',
          label: 'Balances',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
        {
          id: 'account-positions',
          label: 'Positions',
          type: 'table',
          action: 'closePosition',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
        {
          id: 'account-orders',
          label: 'Open Orders',
          type: 'table',
          action: 'cancelOrder',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '400px',
      },
    },
  ],
}

/**
 * Tablet layout: balanced view with collapsible panels.
 *
 * Arrangement:
 * - Top: Market Header + Chart (full width)
 * - Middle: Watchlist (left, collapsible) + Ticket (right, fixed)
 * - Bottom: Collapsible tabs for Order Book, Trades, Account
 */
export const TABLET_LAYOUT: WorkspaceLayout = {
  viewport: 'tablet',
  proModeEnabled: false,
  resizable: true,
  reorderable: false,
  arrangement: 'flex',
  panelOrder: ['marketHeader', 'chart', 'watchlist', 'ticket', 'orderBook', 'trades', 'account'],
  panels: [
    {
      id: 'watchlist',
      title: 'Watchlist',
      hideable: true,
      minWidth: '150px',
      defaultWidth: '40%',
      defaultHeight: '250px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'watchlist-search',
          label: 'Search',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '32px' },
        },
        {
          id: 'watchlist-list',
          label: 'Markets',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '200px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '250px',
      },
    },
    {
      id: 'marketHeader',
      title: 'Market Header',
      hideable: false,
      minHeight: '50px',
      defaultHeight: '50px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'market-selector',
          label: 'Market',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '150px', height: '32px' },
        },
        {
          id: 'market-price',
          label: 'Price',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '120px', height: '24px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '50px',
      },
    },
    {
      id: 'chart',
      title: 'Chart',
      hideable: false,
      minHeight: '250px',
      defaultHeight: '250px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'chart-timeframe',
          label: 'Timeframe',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '250px',
      },
    },
    {
      id: 'ticket',
      title: 'Order Ticket',
      hideable: false,
      minWidth: '200px',
      defaultWidth: '60%',
      defaultHeight: '250px',
      supportedOrderTypes: ['limit', 'market', 'stop-loss', 'take-profit'],
      controls: [
        {
          id: 'ticket-order-type',
          label: 'Order Type',
          type: 'select',
          action: 'switchOrderType',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-side',
          label: 'Side',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-price',
          label: 'Price',
          type: 'input',
          action: 'adjustPrice',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '32px' },
        },
        {
          id: 'ticket-size',
          label: 'Size',
          type: 'input',
          action: 'adjustSize',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '32px' },
        },
        {
          id: 'ticket-submit',
          label: 'Create Order',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '250px',
      },
    },
    {
      id: 'orderBook',
      title: 'Order Book',
      hideable: true,
      minHeight: '200px',
      defaultHeight: '200px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'orderbook-depth',
          label: 'Depth',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'orderbook-bids',
          label: 'Bids',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '80px' },
        },
        {
          id: 'orderbook-asks',
          label: 'Asks',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '80px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '200px',
      },
    },
    {
      id: 'trades',
      title: 'Trades',
      hideable: true,
      minHeight: '200px',
      defaultHeight: '200px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'trades-list',
          label: 'Recent',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '200px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '200px',
      },
    },
    {
      id: 'account',
      title: 'Account',
      hideable: true,
      minHeight: '200px',
      defaultHeight: '200px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'account-balances',
          label: 'Balances',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '100px' },
        },
        {
          id: 'account-positions',
          label: 'Positions',
          type: 'table',
          action: 'closePosition',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '80px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '200px',
      },
    },
  ],
}

/**
 * Mobile layout: single-column flow with tabs.
 *
 * Arrangement:
 * - Full width: Market Header, Chart (swipeable)
 * - Full width: Tabbed interface (Ticket, Book, Trades, Account)
 * - Watchlist: Accessible via drawer/modal
 */
export const MOBILE_LAYOUT: WorkspaceLayout = {
  viewport: 'mobile',
  proModeEnabled: false,
  resizable: false,
  reorderable: false,
  arrangement: 'flex',
  panelOrder: ['marketHeader', 'chart', 'ticket', 'orderBook', 'trades', 'account'],
  panels: [
    {
      id: 'marketHeader',
      title: 'Market Header',
      hideable: false,
      defaultHeight: '50px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'market-selector',
          label: 'Market',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '32px' },
        },
        {
          id: 'market-price',
          label: 'Price',
          type: 'input',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100px', height: '24px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '50px',
      },
    },
    {
      id: 'chart',
      title: 'Chart',
      hideable: false,
      defaultHeight: '300px',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'chart-timeframe',
          label: 'Timeframe',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '300px',
      },
    },
    {
      id: 'ticket',
      title: 'Order Ticket',
      hideable: false,
      defaultHeight: 'flex',
      supportedOrderTypes: ['limit', 'market', 'stop-loss', 'take-profit'],
      controls: [
        {
          id: 'ticket-order-type',
          label: 'Order Type',
          type: 'select',
          action: 'switchOrderType',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-side',
          label: 'Side',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'ticket-price',
          label: 'Price',
          type: 'input',
          action: 'adjustPrice',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'ticket-size',
          label: 'Size',
          type: 'input',
          action: 'adjustSize',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '36px' },
        },
        {
          id: 'ticket-submit',
          label: 'Create Order',
          type: 'button',
          action: 'createOrder',
          visible: true,
          proModeCustomizable: false,
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '300px',
      },
    },
    {
      id: 'orderBook',
      title: 'Order Book',
      hideable: true,
      defaultHeight: 'flex',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'orderbook-depth',
          label: 'Depth',
          type: 'select',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
        },
        {
          id: 'orderbook-bids',
          label: 'Bids',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
        {
          id: 'orderbook-asks',
          label: 'Asks',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '150px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '300px',
      },
    },
    {
      id: 'trades',
      title: 'Trades',
      hideable: true,
      defaultHeight: 'flex',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'trades-list',
          label: 'Recent',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '300px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '300px',
      },
    },
    {
      id: 'account',
      title: 'Account',
      hideable: true,
      defaultHeight: 'flex',
      supportedOrderTypes: [],
      controls: [
        {
          id: 'account-balances',
          label: 'Balances',
          type: 'table',
          action: 'selectMarket',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '100px' },
        },
        {
          id: 'account-positions',
          label: 'Positions',
          type: 'table',
          action: 'closePosition',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '100px' },
        },
        {
          id: 'account-orders',
          label: 'Orders',
          type: 'table',
          action: 'cancelOrder',
          visible: true,
          proModeCustomizable: false,
          loadingGeometry: { width: '100%', height: '100px' },
        },
      ],
      loadingGeometry: {
        skeletonWidth: '100%',
        skeletonHeight: '300px',
      },
    },
  ],
}

/**
 * Get the workspace layout for a specific viewport.
 */
export function getWorkspaceLayout(viewport: Viewport): WorkspaceLayout {
  switch (viewport) {
    case 'desktop':
      return DESKTOP_LAYOUT
    case 'tablet':
      return TABLET_LAYOUT
    case 'mobile':
      return MOBILE_LAYOUT
  }
}

/**
 * Get a specific panel from the layout.
 */
export function getPanel(viewport: Viewport, panelId: PanelId): WorkspacePanel | undefined {
  const layout = getWorkspaceLayout(viewport)
  return layout.panels.find((p) => p.id === panelId)
}

/**
 * Check if a layout supports a specific order type.
 */
export function supportsOrderType(viewport: Viewport, orderType: OrderType): boolean {
  const layout = getWorkspaceLayout(viewport)
  return layout.panels.some((p) => p.supportedOrderTypes.includes(orderType))
}
