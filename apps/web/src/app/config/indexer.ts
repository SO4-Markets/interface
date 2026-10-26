/**
 * apps/web/src/app/config/indexer.ts
 *
 * Indexer configuration derived from environment variables.
 * Validates all indexer-related settings at startup.
 *
 * Usage:
 *   import { INDEXER_CONFIG } from "@/app/config/indexer"
 *   if (INDEXER_CONFIG.enabled) {
 *     // Query SubQuery GraphQL endpoint
 *   }
 */

import { debugLog } from "../../shared/lib/debug-log"
import { ENV } from "./env"

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function optionalIndexerEnv(value: string | undefined): string | null {
  return value ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IndexerConfig = {
  /** GraphQL endpoint URL */
  graphqlUrl: string | null
  /** Whether indexer integration is enabled */
  enabled: boolean
  /** Network context for query isolation */
  network: "testnet" | "mainnet"
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXER_CONFIG — evaluated once at startup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * If VITE_INDEXER_GRAPHQL_URL is not set, indexer is disabled.
 * When disabled, query hooks must gracefully degrade to contract-only or empty data.
 */
export const INDEXER_CONFIG: IndexerConfig = {
  graphqlUrl: optionalIndexerEnv(import.meta.env.VITE_INDEXER_GRAPHQL_URL),
  enabled: !!import.meta.env.VITE_INDEXER_GRAPHQL_URL,
  network: ENV.NETWORK,
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether this runtime has already reported the indexer's state.
 *
 * The app renders server-side, so the module that calls this runs once per
 * request as well as once in the browser — without this latch, a disabled
 * indexer logged the same warning on every route the user visited.
 * Validation itself is pure, so skipping the repeats loses nothing.
 */
let hasReported = false

/** Reset the once-per-runtime log latch. Test-only. */
export function resetIndexerConfigReporting(): void {
  hasReported = false
}

/**
 * Validate indexer config at startup.
 * Throws descriptive error if required vars are missing.
 *
 * Safe to call more than once: the configuration errors below are raised every
 * time, but the informational logs are emitted only on the first call.
 */
export function validateIndexerConfig(): void {
  const report = !hasReported
  hasReported = true

  if (!INDEXER_CONFIG.enabled) {
    if (report) {
      console.warn(
        "Indexer disabled: VITE_INDEXER_GRAPHQL_URL not set. " +
          "Position and order history, fills, and fee activity fall back to " +
          "contract-only data. See apps/web/.env.example.",
      )
    }
    return
  }

  if (!INDEXER_CONFIG.graphqlUrl) {
    throw new Error("VITE_INDEXER_GRAPHQL_URL is required when indexer is enabled")
  }

  if (!["testnet", "mainnet"].includes(INDEXER_CONFIG.network)) {
    throw new Error(`Invalid network: ${INDEXER_CONFIG.network}`)
  }

  if (report) {
    debugLog(`Indexer enabled: ${INDEXER_CONFIG.graphqlUrl} (${INDEXER_CONFIG.network})`)
  }
}
