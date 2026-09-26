---
type: added
area: trade
pr: 738
breaking: false
---

Order cancellation now operates on a single order with full transactional integrity. The contract validates that only the specified order is affected, preventing accidental batch or partial cancellations. A confirmation dialog and explicit completion toast confirm the action to the user.
