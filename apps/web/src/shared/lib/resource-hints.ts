/**
 * Connection hints for the third-party origins the app talks to (#929).
 *
 * `preconnect` finishes DNS + TCP + TLS before the first request, so it is
 * reserved for origins every page hits at startup (Soroban RPC, Horizon).
 * `dns-prefetch` is the cheaper hint, used for origins that are only needed on
 * some routes (Pyth Hermes, Binance order-book/trade feeds on /trade) so idle
 * sockets are not held open for pages that never use them.
 */

export type ResourceHintLink = {
  rel: "preconnect" | "dns-prefetch"
  href: string
  crossOrigin?: "anonymous"
}

export type ResourceHintSources = {
  rpcUrl: string
  horizonUrl: string
  pythHermesUrl: string
}

// Hard-coded in market-data-stream.ts (BINANCE_REST_BASE / BINANCE_WS_URL).
const BINANCE_ORIGINS = ["https://api.binance.com", "https://stream.binance.com"]

/** Origin of an absolute http(s) URL, or undefined for relative paths (e.g. "/api/pyth") and junk. */
export function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.origin
      : undefined
  } catch {
    return undefined
  }
}

export function buildResourceHints(sources: ResourceHintSources): Array<ResourceHintLink> {
  const seen = new Set<string>()
  const links: Array<ResourceHintLink> = []

  const add = (rel: ResourceHintLink["rel"], origin: string | undefined) => {
    if (!origin || seen.has(origin)) return
    seen.add(origin)
    // fetch()/XHR requests are CORS-mode, so the preconnected socket is only
    // reused when the hint is also anonymous-CORS.
    links.push(
      rel === "preconnect"
        ? { rel, href: origin, crossOrigin: "anonymous" }
        : { rel, href: origin },
    )
  }

  add("preconnect", originOf(sources.rpcUrl))
  add("preconnect", originOf(sources.horizonUrl))
  add("dns-prefetch", originOf(sources.pythHermesUrl))
  for (const origin of BINANCE_ORIGINS) add("dns-prefetch", origin)

  return links
}
