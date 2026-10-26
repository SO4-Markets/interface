import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { createServerEntry } from "@tanstack/react-start/server-entry"
import { ENV } from "./app/config/env"
import { INDEXER_CONFIG } from "./app/config/indexer"
import { buildContentSecurityPolicy } from "./shared/lib/security-headers"

/**
 * apps/web/src/server.ts — TanStack Start server entry.
 *
 * Vite auto-detects this file and uses it in place of the framework default
 * (`createServerEntry({ fetch: createStartHandler(defaultStreamHandler) })`).
 *
 * Responsibilities layered on top of the default:
 * - Generate a per-request CSP nonce and hand it to the router, which is the
 *   same channel React and the router use to stamp their inline scripts.
 * - Emit a strict Content-Security-Policy on HTML responses. Production only:
 *   `vite dev` injects inline scripts (react-refresh preamble) and serves
 *   modules through a dev runtime the policy would block. Static headers
 *   (X-Frame-Options, nosniff, ...) live on Nitro route rules in
 *   nitro.config.ts so they also cover assets and API responses.
 */
const startHandler = createStartHandler(async ({ request, router, responseHeaders }) => {
  if (import.meta.env.PROD) {
    const nonce = generateNonce()
    router.options.ssr = { ...router.options.ssr, nonce }
    responseHeaders.set(
      "content-security-policy",
      buildContentSecurityPolicy(nonce, {
        rpcUrl: ENV.RPC_URL,
        horizonUrl: ENV.HORIZON_URL,
        oracleUrl: ENV.ORACLE_URL,
        hermesUrl: ENV.PYTH_HERMES_URL,
        indexerUrl: INDEXER_CONFIG.graphqlUrl,
      }),
    )
  }

  return defaultStreamHandler({ request, router, responseHeaders })
})

/** 128 bits of randomness, hex-encoded — a valid nonce everywhere. */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export default createServerEntry({ fetch: startHandler })
