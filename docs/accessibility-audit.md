# Interface accessibility audit

This checklist is the repeatable review for dialogs, sheets, popovers, icon
buttons, tab controls, and order-book rows.

## Focus and overlays

- Use the Base UI dialog/sheet/popover primitives whenever possible; they own
  focus trapping, Escape handling, and `aria-modal` semantics.
- When an overlay closes, focus returns to the element that opened it, including
  Escape, backdrop dismissal, route changes, and responsive breakpoint changes.
- While an overlay is open, background content is inert and Tab and Shift+Tab
  remain inside the overlay. The first control receives focus.
- Every overlay has an accessible name and description, and hidden content is
  removed from both keyboard navigation and the accessibility tree.

## Touch targets

Interactive controls have a minimum 44×44 CSS pixel hit area on touch layouts:

- icon-only buttons use a `min-h-11 min-w-11` hit area while keeping the icon
  visually compact;
- tab pills and order-book rows use at least `min-h-11` with spacing that keeps
  adjacent controls distinguishable;
- a visually smaller glyph may use padding or an invisible hit area, but must
  remain keyboard focusable and have an accessible name.

## Account and market tables

Narrow-screen financial tables are reviewed as row-context interfaces rather than
as compressed desktop grids. The affected surfaces are:

- Open positions, open orders, order history, and trade/fill history;
- Funding and fee activity;
- Liquidity pool tables;
- Recent trades and cumulative-depth market data.

At widths below the desktop breakpoint, account rows use labelled cards whose
values remain paired with their table-equivalent labels. Essential details are
visible without horizontal scrolling, and row actions stay in the card reading
order. Desktop tables keep horizontal scrolling inside the table region, name
that region for assistive technology, and provide a sticky market column so row
context remains visible while users navigate later columns.

Verify cards and tables at 360 CSS pixels and at desktop widths. Keyboard users
must reach the scroll region, row actions, details toggles, and row selection;
screen readers must receive column headers or card labels and values. Browser
zoom must not introduce page-level horizontal scrolling.

## Verification

For every affected route, run an axe scan and manually verify with keyboard-only
navigation and VoiceOver or NVDA. Test at 360px and desktop widths, with browser
zoom at 200%, and with reduced motion enabled. Record any exception as a
follow-up issue rather than weakening the target or focus behavior.
