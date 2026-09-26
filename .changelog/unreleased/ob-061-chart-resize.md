---
pr: TBD
issues: [OB-061]
packages: [web]
category: fixed
---

# Chart handles resize and cleanup safely

**Trading View** chart container now guards against zero-size dimensions during resize, preventing rendering errors and chart overflow. ResizeObserver and MutationObserver are properly disconnected on unmount, and the chart instance is preserved across ordinary layout changes (like timeframe switches), improving performance and preventing flashes.

## What changed

- Added zero-size dimension guards in ResizeObserver callback
- Improved cleanup documentation for both ResizeObserver and MutationObserver
- Chart instance preservation verified across symbol/period changes  
- Added 5 regression tests covering resize behavior, observer cleanup, and repeated mount-unmount cycles

## Why it matters

Desktop and mobile resizing now keeps axes legible without zero-size flashes. Repeated resize and unmount cycles release observers and chart resources cleanly. Valid visible-range state survives ordinary layout changes without recreating the chart.
