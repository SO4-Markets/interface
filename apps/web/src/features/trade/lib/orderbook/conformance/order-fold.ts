// OB-050: reference fold of an order's event stream (test support).
//
// This is NOT production code. It states, in one place, the rules the account
// UI relies on so the conformance suite can check the production stage
// derivation (`deriveOrderLifecycleStage`) against every arrival order:
//
//  - events are identified by `eventId`; a repeat is the same event, not a new one;
//  - the authoritative order of events is `sequence` (ledger order), never arrival order;
//  - fills add to the filled size once each;
//  - a cancellation that is sequenced AFTER the order is fully filled has no effect,
//    and a fill can never be sequenced after the order was cancelled;
//  - a cancellation request is visible as "pending cancellation" until it is confirmed
//    or rejected.
//
// When the indexer's order/fill schema is consumed directly (OB-047), this fold
// should be replaced by the production reducer and these scenarios kept as its tests.

import {  deriveOrderLifecycleStage } from "../../order-lifecycle"
import type {OrderLifecycleStage} from "../../order-lifecycle";

export type OrderEvent =
  | { eventId: string; sequence: number; type: "created"; sizeUsd: number }
  | { eventId: string; sequence: number; type: "fill"; sizeUsd: number }
  | { eventId: string; sequence: number; type: "cancel-requested" }
  | { eventId: string; sequence: number; type: "cancel-confirmed" }
  | { eventId: string; sequence: number; type: "cancel-rejected" }

export type OrderView = {
  stage: OrderLifecycleStage
  originalSizeUsd: number
  filledSizeUsd: number
  /** Events actually counted (after de-duplication). */
  applied: number
  /** Events ignored as repeats. */
  duplicates: number
}

export function foldOrderEvents(events: ReadonlyArray<OrderEvent>): OrderView {
  const seen = new Set<string>()
  const unique: Array<OrderEvent> = []
  let duplicates = 0
  for (const event of events) {
    if (seen.has(event.eventId)) {
      duplicates++
      continue
    }
    seen.add(event.eventId)
    unique.push(event)
  }
  unique.sort((a, b) => a.sequence - b.sequence)

  let original = 0
  let filled = 0
  let cancelRequested = false
  let cancelled = false
  let created = false

  for (const event of unique) {
    switch (event.type) {
      case "created":
        created = true
        original = event.sizeUsd
        break
      case "fill":
        // Nothing can fill an order that is already cancelled or already complete.
        if (!cancelled && filled < original) filled = Math.min(original, filled + event.sizeUsd)
        break
      case "cancel-requested":
        if (!cancelled && filled < original) cancelRequested = true
        break
      case "cancel-confirmed":
        if (cancelRequested && !cancelled && filled < original) {
          cancelled = true
          cancelRequested = false
        }
        break
      case "cancel-rejected":
        cancelRequested = false
        break
    }
  }

  const stage = deriveOrderLifecycleStage({
    status: cancelled ? "CANCELLED" : filled >= original && original > 0 ? "EXECUTED" : "CREATED",
    awaitingIndex: !created,
    pendingCancellation: cancelRequested,
    originalSizeUsd: original,
    filledSizeUsd: filled,
  })
  return { stage, originalSizeUsd: original, filledSizeUsd: filled, applied: unique.length, duplicates }
}
