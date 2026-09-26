---
type: fixed
area: trade
pr: 1
breaking: false
---

Live market data streams now recover from disconnects and revision gaps using exponential backoff with jitter and a heartbeat watchdog, so the order book and trades tape converge to an authoritative state after any network interruption rather than remaining stale indefinitely.
