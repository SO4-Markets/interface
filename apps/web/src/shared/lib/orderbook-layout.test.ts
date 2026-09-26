import { describe, expect, it } from 'vitest'
import {
  DESKTOP_LAYOUT,
  MOBILE_LAYOUT,
  
  TABLET_LAYOUT,
  
  getPanel,
  getWorkspaceLayout,
  supportsOrderType
} from './orderbook-layout'
import type {PanelId, Viewport} from './orderbook-layout';

describe('orderbook-layout', () => {
  describe('DESKTOP_LAYOUT', () => {
    it('includes all required panels', () => {
      const panelIds = DESKTOP_LAYOUT.panels.map((p) => p.id)
      expect(panelIds).toContain('watchlist')
      expect(panelIds).toContain('marketHeader')
      expect(panelIds).toContain('chart')
      expect(panelIds).toContain('orderBook')
      expect(panelIds).toContain('trades')
      expect(panelIds).toContain('ticket')
      expect(panelIds).toContain('account')
    })

    it('has resizable and reorderable panels', () => {
      expect(DESKTOP_LAYOUT.resizable).toBe(true)
      expect(DESKTOP_LAYOUT.reorderable).toBe(true)
    })

    it('disables Pro mode', () => {
      expect(DESKTOP_LAYOUT.proModeEnabled).toBe(false)
    })

    it('has proper panel ordering', () => {
      expect(DESKTOP_LAYOUT.panelOrder).toEqual([
        'watchlist',
        'marketHeader',
        'chart',
        'orderBook',
        'trades',
        'ticket',
        'account',
      ])
    })

    it('defines controls for each panel', () => {
      DESKTOP_LAYOUT.panels.forEach((panel) => {
        expect(panel.controls.length).toBeGreaterThan(0)
        panel.controls.forEach((control) => {
          expect(control.id).toBeDefined()
          expect(control.label).toBeDefined()
          expect(control.type).toBeDefined()
          expect(control.action).toBeDefined()
        })
      })
    })

    it('enforces mandatory panels are not hideable', () => {
      const mandatoryPanels = ['marketHeader', 'ticket', 'account']
      mandatoryPanels.forEach((panelId) => {
        const panel = DESKTOP_LAYOUT.panels.find((p) => p.id === panelId)
        expect(panel?.hideable).toBe(false)
      })
    })

    it('defines loading geometry for panels', () => {
      DESKTOP_LAYOUT.panels.forEach((panel) => {
        expect(panel.loadingGeometry).toBeDefined()
        expect(panel.loadingGeometry?.skeletonWidth).toBeDefined()
        expect(panel.loadingGeometry?.skeletonHeight).toBeDefined()
      })
    })

    it('ticket supports all order types', () => {
      const ticket = DESKTOP_LAYOUT.panels.find((p) => p.id === 'ticket')
      expect(ticket?.supportedOrderTypes).toContain('limit')
      expect(ticket?.supportedOrderTypes).toContain('market')
      expect(ticket?.supportedOrderTypes).toContain('stop-loss')
      expect(ticket?.supportedOrderTypes).toContain('take-profit')
    })
  })

  describe('TABLET_LAYOUT', () => {
    it('disables reordering but allows resize', () => {
      expect(TABLET_LAYOUT.resizable).toBe(true)
      expect(TABLET_LAYOUT.reorderable).toBe(false)
    })

    it('disables Pro mode', () => {
      expect(TABLET_LAYOUT.proModeEnabled).toBe(false)
    })

    it('includes essential panels', () => {
      const panelIds = TABLET_LAYOUT.panels.map((p) => p.id)
      expect(panelIds).toContain('marketHeader')
      expect(panelIds).toContain('chart')
      expect(panelIds).toContain('ticket')
    })

    it('makes watchlist hideable', () => {
      const watchlist = TABLET_LAYOUT.panels.find((p) => p.id === 'watchlist')
      expect(watchlist?.hideable).toBe(true)
    })

    it('defines smaller dimensions for tablet', () => {
      const ticket = TABLET_LAYOUT.panels.find((p) => p.id === 'ticket')
      expect(ticket?.defaultHeight).toBeDefined()
    })
  })

  describe('MOBILE_LAYOUT', () => {
    it('disables resize and reorder', () => {
      expect(MOBILE_LAYOUT.resizable).toBe(false)
      expect(MOBILE_LAYOUT.reorderable).toBe(false)
    })

    it('disables Pro mode', () => {
      expect(MOBILE_LAYOUT.proModeEnabled).toBe(false)
    })

    it('focuses on essential panels', () => {
      const panelIds = MOBILE_LAYOUT.panels.map((p) => p.id)
      expect(panelIds).toContain('marketHeader')
      expect(panelIds).toContain('chart')
      expect(panelIds).toContain('ticket')
    })

    it('does not include watchlist as panel', () => {
      const panelIds = MOBILE_LAYOUT.panels.map((p) => p.id)
      expect(panelIds).not.toContain('watchlist')
    })

    it('enforces single-column arrangement', () => {
      expect(MOBILE_LAYOUT.arrangement).toBe('flex')
    })

    it('makes orderBook and trades hideable', () => {
      const orderBook = MOBILE_LAYOUT.panels.find((p) => p.id === 'orderBook')
      const trades = MOBILE_LAYOUT.panels.find((p) => p.id === 'trades')
      expect(orderBook?.hideable).toBe(true)
      expect(trades?.hideable).toBe(true)
    })
  })

  describe('getWorkspaceLayout', () => {
    it('returns DESKTOP_LAYOUT for desktop', () => {
      const layout = getWorkspaceLayout('desktop')
      expect(layout).toEqual(DESKTOP_LAYOUT)
    })

    it('returns TABLET_LAYOUT for tablet', () => {
      const layout = getWorkspaceLayout('tablet')
      expect(layout).toEqual(TABLET_LAYOUT)
    })

    it('returns MOBILE_LAYOUT for mobile', () => {
      const layout = getWorkspaceLayout('mobile')
      expect(layout).toEqual(MOBILE_LAYOUT)
    })
  })

  describe('getPanel', () => {
    it('returns panel from layout', () => {
      const panel = getPanel('desktop', 'ticket')
      expect(panel).toBeDefined()
      expect(panel?.id).toBe('ticket')
    })

    it('returns undefined for non-existent panel', () => {
      const panel = getPanel('desktop', 'nonexistent' as PanelId)
      expect(panel).toBeUndefined()
    })

    it('returns different panels for different viewports', () => {
      const desktopWatchlist = getPanel('desktop', 'watchlist')
      const mobileWatchlist = getPanel('mobile', 'watchlist')

      expect(desktopWatchlist).toBeDefined()
      expect(mobileWatchlist).toBeUndefined()
    })
  })

  describe('supportsOrderType', () => {
    it('returns true for supported order type', () => {
      expect(supportsOrderType('desktop', 'limit')).toBe(true)
      expect(supportsOrderType('desktop', 'market')).toBe(true)
    })

    it('returns true for all viewports if ticket panel supports it', () => {
      expect(supportsOrderType('desktop', 'stop-loss')).toBe(true)
      expect(supportsOrderType('tablet', 'stop-loss')).toBe(true)
      expect(supportsOrderType('mobile', 'stop-loss')).toBe(true)
    })
  })

  describe('controls validation', () => {
    it('all controls have actions mapped to SO4', () => {
      const layouts = [DESKTOP_LAYOUT, TABLET_LAYOUT, MOBILE_LAYOUT]
      const validActions = [
        'createOrder',
        'cancelOrder',
        'closePosition',
        'updateCollateral',
        'selectMarket',
        'switchOrderType',
        'adjustPrice',
        'adjustSize',
        'addToWatchlist',
        'removeFromWatchlist',
      ]

      layouts.forEach((layout) => {
        layout.panels.forEach((panel) => {
          panel.controls.forEach((control) => {
            expect(validActions).toContain(control.action)
          })
        })
      })
    })

    it('controls have loading geometry when appropriate', () => {
      const layouts = [DESKTOP_LAYOUT, TABLET_LAYOUT, MOBILE_LAYOUT]
      const renderableTypes = ['input', 'table', 'chart']

      layouts.forEach((layout) => {
        layout.panels.forEach((panel) => {
          panel.controls.forEach((control) => {
            if (renderableTypes.includes(control.type)) {
              expect(control.loadingGeometry).toBeDefined()
            }
          })
        })
      })
    })

    it('Pro mode customization is disabled', () => {
      const layouts = [DESKTOP_LAYOUT, TABLET_LAYOUT, MOBILE_LAYOUT]
      layouts.forEach((layout) => {
        expect(layout.proModeEnabled).toBe(false)
        layout.panels.forEach((panel) => {
          panel.controls.forEach((control) => {
            expect(control.proModeCustomizable).toBe(false)
          })
        })
      })
    })
  })

  describe('market header specifics', () => {
    it('displays essential market information', () => {
      const layouts: Array<Viewport> = ['desktop', 'tablet', 'mobile']
      layouts.forEach((viewport) => {
        const header = getPanel(viewport, 'marketHeader')
        const controlIds = header?.controls.map((c) => c.id) ?? []

        expect(controlIds).toContain('market-selector')
        expect(controlIds).toContain('market-price')
      })
    })
  })

  describe('ticket panel specifics', () => {
    it('has all required order entry controls', () => {
      const layouts: Array<Viewport> = ['desktop', 'tablet', 'mobile']
      layouts.forEach((viewport) => {
        const ticket = getPanel(viewport, 'ticket')
        const controlIds = ticket?.controls.map((c) => c.id) ?? []

        expect(controlIds).toContain('ticket-order-type')
        expect(controlIds).toContain('ticket-side')
        expect(controlIds).toContain('ticket-price')
        expect(controlIds).toContain('ticket-size')
        expect(controlIds).toContain('ticket-submit')
      })
    })

    it('order ticket is mandatory on all viewports', () => {
      const layouts: Array<Viewport> = ['desktop', 'tablet', 'mobile']
      layouts.forEach((viewport) => {
        const ticket = getPanel(viewport, 'ticket')
        expect(ticket?.hideable).toBe(false)
      })
    })
  })

  describe('account panel specifics', () => {
    it('displays balances and positions', () => {
      const layouts: Array<Viewport> = ['desktop', 'tablet']
      layouts.forEach((viewport) => {
        const account = getPanel(viewport, 'account')
        const controlIds = account?.controls.map((c) => c.id) ?? []

        expect(controlIds).toContain('account-balances')
        expect(controlIds).toContain('account-positions')
      })
    })

    it('is mandatory on desktop and tablet', () => {
      expect(getPanel('desktop', 'account')?.hideable).toBe(false)
      expect(getPanel('tablet', 'account')?.hideable).toBe(false)
    })
  })
})
