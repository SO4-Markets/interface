/**
 * Compatibility export for trade feature imports.
 *
 * The canonical query-key factory lives in shared/lib/query-keys so trade,
 * wallet, indexer, earn, pools, faucet, referrals, and landing consumers all
 * share one network/source-aware key hierarchy.
 */
export { queryKeys, activeQueryNetwork, normalizeQueryNetwork } from "@/shared/lib/query-keys"
