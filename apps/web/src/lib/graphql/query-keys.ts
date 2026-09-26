/**
 * Compatibility export for indexer consumers.
 *
 * The implementation lives in shared/lib/query-keys. Keeping this module as a
 * re-export avoids a risky import-path migration while eliminating the
 * previously independent indexer registry.
 */
export { indexerQueryKeys } from "@/shared/lib/query-keys"
