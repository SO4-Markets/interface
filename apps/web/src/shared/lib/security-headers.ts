/**
 * Security response headers for apps/web (security audit remediation).
 *
 * Two layers, split deliberately:
 *
 * 1. Static headers — {@link STATIC_SECURITY_HEADERS}. They never change per
 *    request, so they belong on Nitro route rules where every response kind
 *    (HTML, hashed assets, API routes) picks them up. nitro.config.ts merges
 *    them into each rule because overlapping Nitro rules are matched per
 *    pattern, so a single "/**" entry would leave more specific rules bare.
 *
 * 2. Content-Security-Policy — {@link buildContentSecurityPolicy}. It needs a
 *    fresh nonce per response: TanStack Start renders inline bootstrap scripts
 *    (theme flash guard, stream barrier) whose contents vary, so hashing is
 *    not possible. src/server.ts generates the nonce, hands it to the router
 *    (`router.options.ssr.nonce`, which React and the router use for every
 *    inline script they emit) and builds the policy from the same value.
 *
 * This module stays free of React and import.meta.env: nitro.config.ts imports
 * it at build time, before any runtime env exists.
 */

export interface CspEndpoints {
  /** Soroban RPC endpoint (VITE_RPC_URL). */
  rpcUrl: string | null
  /** Stellar Horizon endpoint (VITE_HORIZON_URL). */
  horizonUrl: string | null
  /** GMX-style oracle HTTP API (VITE_ORACLE_URL). */
  oracleUrl: string | null
  /** Pyth Hermes price feed (VITE_PYTH_HERMES_URL). */
  hermesUrl: string | null
  /** SubQuery indexer GraphQL endpoint; null while the indexer is disabled. */
  indexerUrl: string | null
}

/**
 * The GMX oracle API the trade page reads benchmark prices from. This is the
 * default of ENV.ORACLE_URL; the configured value is allow-listed separately.
 */
const GMX_ORACLE_ORIGIN = "https://arbitrum-api.gmxinfra.io"
/** SO4's own oracle proxy worker (contract oracle reads). */
const SO4_ORACLE_ORIGIN = "https://oracle.biscotti-proxy-worker.workers.dev"
/** Binance REST market data (orderbook snapshots). */
const BINANCE_REST_ORIGIN = "https://api.binance.com"
/** Binance WebSocket market data stream. */
const BINANCE_WS_ORIGIN = "wss://stream.binance.com:9443"
/** Pyth benchmark price API. */
const PYTH_BENCHMARKS_ORIGIN = "https://benchmarks.pyth.network"

/**
 * Remote image hosts. Token icons (jsdelivr), gallery avatar previews
 * (dicebear) and the Stellar Wallets Kit icon set (creit.tech + OneKey).
 * The kit's only network surface is these icons; wallet signing talks to
 * browser extensions over postMessage, not HTTP.
 */
const IMAGE_ORIGINS = [
  "https://cdn.jsdelivr.net",
  "https://api.dicebear.com",
  "https://stellar.creit.tech",
  "https://uni.onekey-asset.com",
] as const

/**
 * Cross-origin frames. @albedo-link/intent loads a hidden 0x0 iframe against
 * albedo.link when it reuses an implicit session; the interactive flow is a
 * popup ("https://albedo.link/confirm") which CSP does not govern.
 */
const FRAME_ORIGINS = ["https://albedo.link"] as const

/**
 * Headers applied to every response through Nitro route rules.
 *
 * - X-Frame-Options / CSP frame-ancestors: the dapp is never embedded.
 * - COOP keeps cross-origin popups (Albedo's signer window) working while
 *   isolating the app from cross-origin opener documents.
 * - HSTS is ignored over plain HTTP, so it is safe on non-TLS previews.
 */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
}

/** Reduces a configured endpoint URL to its origin, or null when unusable. */
function toOrigin(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Deduplicates and sorts a source list so policies are deterministic. */
function toSourceList(values: Array<string | null>): Array<string> {
  return [...new Set(values.filter((value): value is string => value !== null))].sort()
}

/**
 * Builds the Content-Security-Policy for one HTML response.
 *
 * `script-src` is nonce-based (no 'unsafe-inline'): the only inline scripts in
 * the document are the nonce-carrying ones emitted by React/the router and the
 * theme/JSON-LD tags in routes/__root.tsx. `style-src` deliberately keeps
 * 'unsafe-inline' — inline styles are not script execution, and both React
 * (style props via CSSOM) and libraries that inject <style> at runtime
 * (lightweight-charts) rely on them; the docs app carries the same allowance.
 */
export function buildContentSecurityPolicy(nonce: string, endpoints: CspEndpoints): string {
  const connectSources = toSourceList([
    "'self'",
    toOrigin(endpoints.rpcUrl),
    toOrigin(endpoints.horizonUrl),
    toOrigin(endpoints.oracleUrl),
    toOrigin(endpoints.hermesUrl),
    toOrigin(endpoints.indexerUrl),
    GMX_ORACLE_ORIGIN,
    SO4_ORACLE_ORIGIN,
    BINANCE_REST_ORIGIN,
    BINANCE_WS_ORIGIN,
    PYTH_BENCHMARKS_ORIGIN,
  ])

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${FRAME_ORIGINS.join(" ")}`,
    "manifest-src 'self'",
  ]

  return directives.join("; ")
}
