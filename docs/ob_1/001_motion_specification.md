# Motion Specification (OB-007)

Status: Complete specification for SO4-Markets interface motion design system.

---

## 1. Overview & Core Philosophy

This specification establishes the motion design rules for the SO4-Markets trading platform. Motion serves to clarify state transitions, preserve spatial orientation, and provide subtle feedback without obscuring real-time market data or degrading execution responsiveness.

### Principles

1. **Restrained Feedback in Trading**: High-frequency updates (price changes, order book updates, account balances) must remain stable and legible. Decorative animations, rolling digits, layout shifts, or live data reordering are strictly prohibited.
2. **Trigger-Aware Overlays**: Popovers, dropdown menus, context menus, and select popups calculate entrance transform origins based on their trigger positioning (`origin-(--transform-origin)`).
3. **Strict Accessibility Compliance**: Every animated element honors system `prefers-reduced-motion` preferences immediately. Keyboard actions (Escape, Tab, focus shifts) take precedence over animation completion.
4. **No Parallel Libraries**: Reuse existing `@workspace/ui` primitives and tokens. Extending `@workspace/ui/components/toast` is mandatory; installing external animation/toast libraries (e.g. Sonner) is prohibited.

---

## 2. Motion Tokens & Approved Budgets

All motion uses existing CSS variables declared in `packages/ui/src/styles/globals.css`.

| Token Name | Value | Scope & Usage |
|---|---|---|
| `--duration-fast` | 100ms | Immediate trading feedback, numeric change emphasis, selection states |
| `--duration-base` | 150ms | Standard overlays, dropdown menus, select popups, popover entrances |
| `--duration-moderate` | 200ms | Dialogs, sheets, section reveals, panel drawer transitions |
| `--duration-slow` | 300ms | Landing storytelling, hero banner word rotation |
| `--duration-slowest` | 400ms | Extended landing page sequences |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for state transitions & background feedback |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entry transitions (popups, dialogs opening) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit transitions (popups closing) |

---

## 3. Interaction Matrix

| Interaction Area | Purpose | Timing & Token | Property & Transform | Reduced Motion Fallback | Rapid Interruption Handling |
|---|---|---|---|---|---|
| **Entrances & Exits (General)** | Smooth introduction of overlay surfaces without blocking layout rendering. | 150ms (`--duration-base`), `--ease-out` (in), `--ease-in` (out) | `opacity` (0 → 1), `scale` (0.95 → 1.0) | Instant opacity toggle (0ms duration). | Active CSS transitions cancel mid-flight without leaving stale DOM elements. |
| **Dropdown Menus & Selects (OB-016)** | Contextual menu popups that scale naturally from their trigger element near viewport edges. | 150ms (`--duration-base`), `--ease-out` | `origin-(--transform-origin)`, `opacity`, `transform` (slide-in from positioner side) | Immediate position & visibility display. | Rapid reopen resets transform origin without focus loss or invisible backdrop overlays. |
| **Dialogs & Modals** | High-priority user confirmation or setup flows (e.g. order confirmation, wallet connect). | 200ms (`--duration-moderate`), `--ease-out` | Backdrop: `opacity` (0 → 1); Surface: `scale` (0.95 → 1.0), `translateY` | Immediate presentation of modal dialog. | Escape key or backdrop click triggers exit animation; keyboard focus returns instantly to trigger. |
| **Tabs & Segmented Controls** | Visual cue for active view/section selection across trade workspace panels. | 100ms (`--duration-fast`), `--ease-in-out` | `background-color`, `border-color`, `color` | Instant style swap without indicator animation. | Instant switch on keydown; tab index updates synchronously. |
| **Toasts** | Scoped notifications for transaction submission, ledger confirmation, and error reports. | 150ms (`--duration-base`), `--ease-out` | `translateY` (-8px → 0px), `opacity` (0 → 1) | Instant display without motion. | Toast stack coalesces duplicate messages without overlapping layout shifts. |
| **Loading Transitions** | Loading skeletons and status spinners during asynchronous query execution. | Pulse: 1.5s loop; Spin: 1s linear loop | Skeleton `opacity` (0.5 ↔ 1.0); Spinner `rotate(0deg → 360deg)` | Static muted placeholder; zero rotation. | Replaced cleanly as soon as TanStack Query resolves data. |
| **Numeric Change Emphasis (OB-019)** | Restrained semantic flash when live prices, order book values, or account balances update. | 100ms (`--duration-fast`) fade, 500ms coalesce window | Background tint (`bg-success/10` / `bg-destructive/10`), text tone | Immediate tabular text update without background tint flash. | Rapid value bursts reset the 500ms timeout timer without re-triggering stacked animations or ARIA announcements. |

---

## 4. Prohibited Behaviors & Invariants

1. **No Rolling Digits or Width Shifts**: Numbers must use `font-mono tabular-nums slashed-zero`. Decimal places, column widths, and line-heights must remain fixed to prevent click targets or headers from shifting.
2. **No Decorative Reordering of Live Data**: Live lists (order book depth, recent trades, position tables) must not slide or animate row swaps during live streaming updates.
3. **No Delayed Keyboard Operations**: Pressing `Escape` or `Enter` must immediately register logic and dismiss popovers, regardless of whether an exit transition CSS timer has elapsed.
4. **No ARIA Live Announcement per Tick**: Live market price flashes must not attach `aria-live="assertive"` on rapid ticks to avoid overwhelming screen reader users.

---

## 5. Review & Verification Checklist

- [x] All motion tokens reference `--duration-*` and `--ease-*` from `packages/ui/src/styles/globals.css`.
- [x] `prefers-reduced-motion` verified across all components.
- [x] Trigger-following popover placement verified near screen boundaries.
- [x] Restrained numeric change feedback verified for stable digit rendering.
- [x] Existing custom toast system maintained without external libraries.
