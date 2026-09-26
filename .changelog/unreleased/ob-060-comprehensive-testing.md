---
pr: TBD
area: testing
breaking: false
---

# Comprehensive order book panel test coverage

**OB-060**: Added extensive test coverage for the order book panel, depth ladder, and trades tape components. Tests verify interaction patterns, numeric formatting, state management, stale recovery, and assistive technology support.

## Test Coverage Added

### OrderBookPanel Tests (14 tests)
- **Tab switching**: Default state, keyboard and touch navigation between book/trades tabs
- **Symbol handling**: Prop changes, undefined symbol handling, updates on symbol change
- **Accessibility**: ARIA roles, tab states, keyboard accessibility
- **Responsive behavior**: Essential elements in compact layout
- **Reference data label**: Visibility across tabs

### DepthLadder Tests (31 tests)
- **Rendering and layout**: Table structure, column headers, bid/ask row ordering, spread display
- **Large numbers formatting**: Thousands separators, decimal places (prices with 2, sizes with 3-4, totals with 3-4)
- **Edge cases**: Very small decimals, large integers, cumulative totals
- **Loading states**: Skeleton display, progressive loading
- **Empty states**: No data, one-sided books (bids only / asks only)
- **Stale/reconnecting overlays**: Preserves last snapshot with visible overlay during stale, reconnecting, and revision-gap states
- **Source health badges**: Live, Connecting, No Depth, Rate Limited, Error states
- **Accessibility**: Descriptive ARIA labels, rowgroups, separator roles, screen reader support
- **Symbol changes**: Dynamic updates, undefined symbol handling
- **Compact mode**: Layout variations

### RecentTradesTape Tests (28 tests)
- **Rendering**: Table structure, trade rows, buy/sell/unknown side styling
- **Number formatting**: Price with 4 decimals, quantity with 2-4 decimals, timestamp formatting
- **Large datasets**: Very small quantities, high-precision decimals
- **Loading states**: Skeleton while loading, progressive display
- **Empty states**: No trades message with symbol context
- **Busy tape behavior**: 50+ trades rendered efficiently, memoization verification
- **Stale/reconnecting overlays**: Data preservation under overlay, reconnecting/resyncing states
- **Source health badges**: All connection states
- **Accessibility**: Table semantics, column headers, status roles, unknown side titles
- **Symbol changes**: Dynamic updates

## Test Characteristics

- **Total: 73 tests** covering order book panel functionality
- **Interaction**: Tab switching, keyboard navigation, touch support
- **Numeric robustness**: Thousands separators, decimal precision, very small/large numbers
- **State management**: Loading, empty, stale, reconnecting, error states
- **Accessibility**: ARIA roles, labels, semantic HTML, screen reader support
- **Mocking**: Proper hook mocking with realistic state shapes
- **Deterministic**: No timers or network dependencies, repeatable results

## User-Visible Behavior

No functional changes — this is pure test coverage addition. All tests verify existing behavior to prevent regressions during future development.

## Technical Notes

- Tests use Vitest + React Testing Library
- Mocks isolate components from hook implementation details
- Coverage includes both happy paths and edge cases
- Accessibility tests verify ARIA attributes and semantic structure
- Number formatting tests ensure consistent display across locales
- Stale overlay tests verify data preservation and recovery UX
