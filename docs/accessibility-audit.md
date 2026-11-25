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

## Verification

For every affected route, run an axe scan and manually verify with keyboard-only
navigation and VoiceOver or NVDA. Test at 360px and desktop widths, with browser
zoom at 200%, and with reduced motion enabled. Record any exception as a
follow-up issue rather than weakening the target or focus behavior.

## Trading data states

- Chart, order-book, recent-trades, and positions views distinguish loading,
  empty, stale, and unavailable states. Loading uses geometry-preserving
  skeletons or a stable status region and never prints fabricated values.
- Empty states describe the missing result (for example, no open orders or no
  depth data). Feed, network, and wallet failures use explicit copy and a
  retry/reconnect action where one is available.
- State changes use `role="status"` for progress and `role="alert"` for failures
  that require attention. Wallet connection and network health remain separate
  from transaction confirmation and ledger execution status.
