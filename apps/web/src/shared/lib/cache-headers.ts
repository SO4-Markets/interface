/**
 * Cache Headers & Route Rules Configuration (OB-125)
 *
 * Implements safe, deterministic caching policies:
 * 1. Static immutable build assets: public, max-age=1yr, immutable
 * 2. HTML documents / navigation entry points: public, max-age=0, must-revalidate
 * 3. Private financial & account data: private, no-store, no-cache, must-revalidate
 * 4. Public market data & quote feeds: short TTL with stale-while-revalidate (OB-005 compliant)
 */

export type CacheCategory =
  | "immutable-asset"
  | "revalidating-document"
  | "private-financial"
  | "public-market-feed"
  | "public-static-data"

export interface CacheControlDirectives {
  scope?: "public" | "private"
  maxAge?: number
  staleWhileRevalidate?: number
  immutable?: boolean
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
}

export const CACHE_POLICIES: Record<CacheCategory, CacheControlDirectives> = {
  "immutable-asset": {
    scope: "public",
    maxAge: 31_536_000, // 1 year
    immutable: true,
  },
  "revalidating-document": {
    scope: "public",
    maxAge: 0,
    mustRevalidate: true,
    noCache: true,
  },
  "private-financial": {
    scope: "private",
    noCache: true,
    noStore: true,
    mustRevalidate: true,
  },
  "public-market-feed": {
    scope: "public",
    maxAge: 1,
    staleWhileRevalidate: 4,
  },
  "public-static-data": {
    scope: "public",
    maxAge: 60,
    staleWhileRevalidate: 300,
  },
}

/** Formats cache control directives into a valid HTTP Cache-Control header string. */
export function formatCacheControl(directives: CacheControlDirectives): string {
  const parts: Array<string> = []

  if (directives.noStore) {
    if (directives.scope) parts.push(directives.scope)
    parts.push("no-store", "no-cache", "must-revalidate")
    return parts.join(", ")
  }

  if (directives.scope) {
    parts.push(directives.scope)
  }

  if (directives.noCache) {
    parts.push("no-cache")
  }

  if (typeof directives.maxAge === "number") {
    parts.push(`max-age=${directives.maxAge}`)
  }

  if (directives.immutable) {
    parts.push("immutable")
  }

  if (directives.mustRevalidate) {
    parts.push("must-revalidate")
  }

  if (typeof directives.staleWhileRevalidate === "number") {
    parts.push(`stale-while-revalidate=${directives.staleWhileRevalidate}`)
  }

  return parts.join(", ")
}

/** Get the standard Cache-Control header string for a given cache category. */
export function getCacheControlHeader(category: CacheCategory): string {
  return formatCacheControl(CACHE_POLICIES[category])
}

export interface NitroRouteRule {
  headers?: Record<string, string>
  cache?: {
    maxAge?: number
    staleMaxAge?: number
    swr?: boolean
  }
}

/** Generates standard Nitro routeRules configuration mapping URL patterns to safe headers. */
export function getNitroRouteRules(): Record<string, NitroRouteRule> {
  const immutableHeader = getCacheControlHeader("immutable-asset")
  const documentHeader = getCacheControlHeader("revalidating-document")
  const privateHeader = getCacheControlHeader("private-financial")
  const marketFeedHeader = getCacheControlHeader("public-market-feed")
  const staticDataHeader = getCacheControlHeader("public-static-data")

  return {
    // Immutable hashed assets
    "/assets/**": {
      headers: { "cache-control": immutableHeader },
    },
    "/_app/**": {
      headers: { "cache-control": immutableHeader },
    },
    "/build/**": {
      headers: { "cache-control": immutableHeader },
    },
    "/**/*.woff2": {
      headers: { "cache-control": immutableHeader },
    },
    "/**/*.png": {
      headers: { "cache-control": immutableHeader },
    },
    "/**/*.svg": {
      headers: { "cache-control": immutableHeader },
    },
    "/**/*.ico": {
      headers: { "cache-control": immutableHeader },
    },

    // Private / sensitive financial endpoints
    "/api/account/**": {
      headers: { "cache-control": privateHeader },
    },
    "/api/user/**": {
      headers: { "cache-control": privateHeader },
    },
    "/api/wallet/**": {
      headers: { "cache-control": privateHeader },
    },
    "/api/orders/**": {
      headers: { "cache-control": privateHeader },
    },
    "/api/positions/**": {
      headers: { "cache-control": privateHeader },
    },

    // Market data feeds & quotes
    "/api/markets/**": {
      headers: { "cache-control": marketFeedHeader },
    },
    "/api/quotes/**": {
      headers: { "cache-control": marketFeedHeader },
    },
    "/api/depth/**": {
      headers: { "cache-control": marketFeedHeader },
    },

    // Static metadata / token lists
    "/api/tokens/**": {
      headers: { "cache-control": staticDataHeader },
    },

    // HTML entrypoints & navigation routes
    "/**": {
      headers: { "cache-control": documentHeader },
    },
  }
}
