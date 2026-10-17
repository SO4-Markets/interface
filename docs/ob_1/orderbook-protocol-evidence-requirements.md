# Protocol Evidence Requirements for Executable Order Book

**Status:** Blocking OB-041, OB-042, OB-043, OB-044  
**Date:** 2026-10-16  
**To:** Protocol / Venue Team  
**From:** Interface Team

## Executive Summary

The interface cannot implement an executable order book until the protocol provides evidence of a native price-time matching venue or a clear specification of the keeper venue's executable depth API. The current state is an integrated keeper venue over unified pool liquidity, which does not provide resting executable depth.

This document specifies the exact evidence, API specifications, and test fixtures required to unblock the four P0 order book issues.

---

## Current Blocking State

As documented in [`order-book-execution-model.md`](./order-book-execution-model.md), the following capabilities are **missing**:

| Capability | Current State | Required Evidence |
|------------|---------------|-------------------|
| **Matching** | Keeper-triggered against oracle price and pool liquidity; no bid/ask matcher or price-time queue | Named venue design, contract/API, and replayable match test |
| **Resting Liquidity** | Pool is the counterparty, not a resting order queue | Source of truth for level-2 depth, sequence, and stale-data behavior |
| **Partial Fills** | `ord_exe` records execution, but no fill quantity/remaining quantity contract exposed | Contract event/API with fill quantity, remaining quantity, and idempotency key |
| **Settlement** | Position changes and pool accounting settle keeper executions; no order-book trade settlement API | Settlement contract/API, fill authority, and reconciliation fixture |

---

## Issue-Specific Requirements

### OB-041: Specify the authoritative depth and trade-feed API

**Acceptance Criteria:** Real captured examples establish which rows are executable, which order types contribute, and how updates/deletions are represented.

#### Required Evidence

1. **Venue Identity and Endpoint**
   - Production or testnet URL for the depth/trade feed API
   - Authentication method (if any)
   - Venue identifier (e.g., "SO4-Testnet-Matcher-1", "SO4-Mainnet-PriceTime-v2")
   - Supported markets with their market IDs

2. **Snapshot Format Specification**
   - Complete example JSON payload for a depth snapshot
   - Field documentation:
     - `bids`/`asks` array structure
     - Price representation (decimal string, integer, float?)
     - Size representation (decimal string, integer, float?)
     - Sequence/revision ID field name and type
     - Timestamp field(s) and units (ms, s, ns?)
     - Market identifier field
   - Number of levels returned by default
   - Pagination behavior for deeper depth

3. **Delta Format Specification**
   - Complete example JSON payload for a depth update
   - Field documentation:
     - `bids`/`asks` array structure
     - How deletions are represented (zero size, explicit delete flag, absent?)
     - Sequence/revision ID field and monotonicity guarantees
     - Timestamp field(s)
   - Ordering guarantees (strictly increasing revision? out-of-order possible?)
   - Gap detection protocol (how client knows when to resync)

4. **Trade Feed Format Specification**
   - Complete example JSON payload for trade updates
   - Field documentation:
     - Trade ID / sequence number
     - Price representation
     - Quantity representation
     - Side determination (maker/taker, buy/sell?)
     - Timestamp field(s)
     - Market identifier
   - Which order types contribute to trades (limit? market? trigger?)
   - How self-trades or cross-trades are represented

5. **Streaming vs Polling Semantics**
   - WebSocket endpoint URL (if streaming available)
   - Subscription message format
   - Heartbeat mechanism (ping/pong interval, inactivity timeout)
   - Reconnection protocol (backoff behavior, sequence recovery)
   - Polling endpoint URL and rate limits (if streaming unavailable)

6. **Executable Depth Guarantees**
   - Which price levels are immediately executable (best N? all displayed?)
   - Non-executable order types (e.g., iceberg, hidden, post-only) and how they're marked
   - Minimum tick size enforcement in the feed
   - Minimum lot size enforcement in the feed
   - Venue identity in trade messages (to distinguish SO4 liquidity from reference data)

7. **Precision and Timestamps**
   - Price precision per market (number of decimal places)
   - Size precision per market
   - Timestamp semantics (provider event time vs. server receive time)
   - Clock offset between provider and client expectations

8. **Resynchronization Protocol**
   - How to recover from sequence gaps
   - Whether buffered deltas should be replayed after a new snapshot
   - Behavior during maintenance windows
   - Error codes and their meanings

#### Deliverable Format

Provide:
- Markdown or OpenAPI specification document
- 3-5 real captured JSON examples for each message type (snapshot, delta, trade)
- Testnet credentials or public endpoint access
- Code example showing a successful connection and subscription

---

### OB-042: Implement typed snapshot and trade-feed adapters

**Acceptance Criteria:** Contract fixtures cover valid, empty, malformed, wrong-market, and unsupported-version payloads without unsafe casts.

**Blocker:** Cannot implement until OB-041 provides the API specification and real examples.

#### Prerequisites from OB-041

- Snapshot JSON schema (for runtime validation)
- Delta JSON schema
- Trade JSON schema
- Error response schemas
- Version field location and format

#### Additional Requirements

1. **Source Identity Preservation**
   - Adapter must preserve the exact decimal strings from the source
   - No JavaScript `parseFloat` that loses precision during parsing
   - Sequence/revision metadata must be carried through unchanged
   - Source timestamps must be preserved separately from receipt time

2. **Validation Contracts**
   - TypeScript types matching the source schema exactly
   - Zod or similar runtime validator for each message type
   - Safe-by-default parsing (any unknown field or type mismatch fails validation)
   - Recoverable error type (data error, not silent failure)

3. **Fixture Requirements**
   - Valid snapshot with full depth
   - Empty snapshot (no bids/asks)
   - Malformed payload (missing required fields, wrong types)
   - Wrong market identifier
   - Unsupported version number
   - Delta with deletions (zero-size entries)
   - Trade with unknown side

#### Deliverable Format

Protocol team provides:
- TypeScript interface definitions matching the source API
- 10+ real captured examples covering edge cases
- Any field-level validation rules not obvious from the schema

---

### OB-043: Verify order submission and cancellation against the selected venue

**Acceptance Criteria:** A documented test-environment scenario accepts a resting order, observes its authoritative identity, and cancels or fills it through the same venue.

**Blocker:** "Missing matching/settlement deployments keep this issue blocked."

#### Required Evidence

1. **Test Environment**
   - Testnet venue endpoint (matching engine or keeper service)
   - Testnet wallet with sufficient collateral
   - Test market with active liquidity
   - Authentication credentials (API key, JWT, or wallet signature method)

2. **Order Submission API**
   - HTTP endpoint or contract method for order submission
   - Request payload specification:
     - Market identifier
     - Side (buy/sell)
     - Order type (limit/market/trigger)
     - Price (precision, decimal places)
     - Size (precision, decimal places)
     - Time-in-force (GTC, IOC, FOK, etc.)
     - Client order ID / idempotency key
   - Response payload specification:
     - Order identifier (venue-assigned)
     - Status (accepted, rejected, pending)
     - Timestamp
     - Any warnings or partial acceptances
   - Error codes and their meanings

3. **Order Cancellation API**
   - HTTP endpoint or contract method for cancellation
   - Request payload specification:
     - Order identifier (from submission response)
     - Or client order ID
   - Response payload specification:
     - Cancellation success/failure
     - Reason if failed (already filled, already cancelled, not found)
     - Remaining quantity if partially filled
   - Race condition behavior (cancel vs. fill arriving simultaneously)

4. **Order Status Query API**
   - Endpoint to query order status by ID
   - Response payload specification:
     - Current status (resting, partially filled, filled, cancelled, rejected)
     - Remaining quantity
     - Average fill price
     - Cumulative filled quantity
     - Fill history (if available)

5. **Execution Semantics**
   - How partial fills are reported (single update with remaining qty, or per-fill events?)
   - Maker/taker designation (or not applicable for keeper venue?)
   - Fee calculation and deduction
   - Slippage tolerance for market orders
   - Post-only vs. allow-taker flags

6. **End-to-End Test Scenario**
   Protocol team must demonstrate:
   ```
   1. Submit limit order → receives order ID, status = "resting"
   2. Query order → confirms resting with full quantity
   3. Submit opposing market order (or wait for natural fill)
   4. Query order → status = "partially filled" or "filled"
   5. Cancel remaining (if any) → success with remaining qty
   6. Query order → status = "cancelled" or "filled"
   ```

7. **Signature / Authorization**
   - If using wallet signature: message format, hashing algorithm, signature placement
   - If using API key: key generation, rotation, permission scope
   - If using JWT: token endpoint, lifetime, refresh mechanism

#### Deliverable Format

Provide:
- Postman collection or curl commands for each API call
- Testnet credentials with limited permissions
- Video or log dump showing the end-to-end scenario
- Contract addresses for any on-chain submission path

---

### OB-044: Add exact price and size normalization

**Acceptance Criteria:** Boundary fixtures cover tiny ticks, large notionals, nonzero token decimal differences, and values just above/below a valid increment.

**Blocker:** Depends on OB-003 (market identity model, which exists) and OB-042 (adapters, which is blocked).

#### Prerequisites from OB-003

The market identity model already provides:
- `MarketPrecision` with `priceDecimals` and `sizeDecimals`
- `tickSize` and `lotSize` per market
- `minimumNotional` per market

These are implemented in `apps/web/src/shared/lib/market-identity.ts`.

#### Additional Requirements from Protocol Team

1. **Tick/Lot Enforcement Rules**
   - Are tick/lot sizes enforced server-side? (what happens if client sends non-conforming values?)
   - Rounding policy for market orders (round up, round down, round to nearest?)
   - Minimum notional enforcement (reject vs. partial fill?)

2. **Decimal Precision by Market**
   For each market:
   - Base asset decimal places (e.g., BTC has 8 decimals)
   - Quote asset decimal places (e.g., USDC has 6 decimals)
   - Price display precision (UI formatting)
   - Price internal precision (API transmission)
   - Size display precision
   - Size internal precision

3. **Edge Case Behavior**
   - Values just below tick size (e.g., tick = 0.01, price = 0.00999)
   - Values just above tick size (e.g., tick = 0.01, price = 0.01001)
   - Tiny tick sizes (e.g., 0.00000001)
   - Large notionals (e.g., $1,000,000+ order)
   - Minimum notional boundary (e.g., min = $10, order = $9.99)

4. **Arithmetic Safety**
   Protocol team must specify:
   - Whether to use integer arithmetic for all price/size calculations
   - Conversion factors (e.g., price = internal_price / 10^price_decimals)
   - Overflow/underflow behavior
   - Whether division or modulo operations are allowed in smart contracts

#### Deliverable Format

Provide:
- Table of all markets with their precision specifications
- Rounding policy document
- Test cases showing expected behavior for edge cases
- Example of how price/size should be converted to/from internal representation

---

## Combined Test Evidence

To unblock all four issues simultaneously, the protocol team should provide a **single test harness** that demonstrates:

```typescript
// Pseudocode of what the interface needs to verify
const testHarness = {
  // 1. Connect to venue
  venue: await connectToVenue("testnet-so4-matcher"),

  // 2. Subscribe to depth feed
  depthStream: await venue.subscribeDepth("BTC-USDT"),
  // Captures: snapshot JSON, delta JSONs, sequence IDs

  // 3. Subscribe to trade feed
  tradeStream: await venue.subscribeTrades("BTC-USDT"),
  // Captures: trade JSONs, trade IDs, sides

  // 4. Submit a test order
  order: await venue.submitOrder({
    market: "BTC-USDT",
    side: "buy",
    type: "limit",
    price: "50000.00",  // Exact decimal string
    size: "0.001",      // Exact decimal string
    clientId: "test-123"
  }),
  // Captures: order ID, status, timestamp

  // 5. Observe order in depth feed
  // Captures: how resting orders appear in bids/asks

  // 6. Cancel or fill the order
  cancellation: await venue.cancelOrder(order.id),
  // Captures: success/failure, remaining qty

  // 7. Verify final state
  finalStatus: await venue.getOrderStatus(order.id),
  // Captures: terminal state, fill details
}
```

The output of this test harness (logs, JSON payloads, timestamps) would provide all the evidence needed for OB-041, OB-042, OB-043, and OB-044.

---

## Prioritization

The most critical dependency is **OB-041's API specification**. Without it:

- OB-042 cannot write adapters (no schema to validate against)
- OB-043 cannot test submission (no endpoint to submit to)
- OB-044 cannot normalize correctly (no precision rules to apply)

**Recommended sequence:**

1. **Protocol team provides OB-041 evidence** (API spec + real examples)
2. **Interface team implements OB-042** (typed adapters)
3. **Protocol team provides OB-043 test environment** (testnet + credentials)
4. **Interface team implements OB-043** (submission/cancellation verification)
5. **Interface team implements OB-044** (normalization, now that adapters exist)

---

## Contact

For questions or clarifications on these requirements, contact:
- Interface Team: [GitHub Issues](https://github.com/SO4-Markets/interface/issues)
- Protocol Team: [Reference in project documentation]

---

## Appendix: Existing Code References

### Market Identity Model (OB-003) - Already Implemented
- File: `apps/web/src/shared/lib/market-identity.ts`
- Exports: `MarketIdentity`, `MarketCapabilities`, `AssetPrecision`, `MarketPrecision`
- Status: ✅ Complete, no protocol action needed

### Data Freshness Contracts (OB-005) - Already Implemented
- File: `apps/web/src/shared/lib/data-freshness.ts`
- Exports: `DataFreshnessContract`, `RefreshMatrix`, `DataStreamConfig`
- Status: ✅ Complete, no protocol action needed

### Reference Implementation (Binance) - Not SO4
- File: `apps/web/src/features/trade/lib/market-data-stream.ts`
- Venue: "Binance Reference" (explicitly marked as reference data, not executable)
- Status: ⚠️ Placeholder, does not represent SO4 liquidity

### Execution Model Documentation
- File: `docs/order-book-execution-model.md`
- Status: ✅ Documents the current blocker
