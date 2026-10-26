import { defineHandler } from "nitro"
import { normalizePythQuery } from "../../../src/features/trade/lib/pyth-proxy-query"

/**
 * Same-origin Hermes proxy. PYTH_API_KEY is read only on the server; never
 * expose it via VITE_ variables or forward arbitrary client-provided URLs.
 *
 * The endpoint is public, so it must not become a free relay for the paid
 * key. Upstream usage is bounded without needing client identity:
 * - only the app's own feed IDs and the exact query options the app sends
 *   are accepted, so the set of distinct upstream requests is tiny;
 * - identical requests share one upstream response for CACHE_TTL_MS.
 */
const UPSTREAM = "https://pyth.dourolabs.app/hermes/v2/updates/price/latest"
const CACHE_TTL_MS = 1_000
type CachedResponse = { expires: number; status: number; contentType: string; body: ArrayBuffer }
const cache = new Map<string, CachedResponse>()
const inflight = new Map<string, Promise<CachedResponse>>()

async function fetchUpstream(search: string, apiKey: string): Promise<CachedResponse> {
  const response = await fetch(`${UPSTREAM}?${search}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  })
  return {
    expires: Date.now() + CACHE_TTL_MS,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "application/json",
    body: await response.arrayBuffer(),
  }
}

export default defineHandler(async (event) => {
  const path = event.url.pathname.replace(/^\/api\/pyth/, "")
  if (event.req.method !== "GET" || path !== "/v2/updates/price/latest") {
    return new Response("Not found", { status: 404 })
  }

  const apiKey = process.env.PYTH_API_KEY
  if (!apiKey) {
    return new Response("Pyth price feed is not configured", { status: 503 })
  }

  const search = normalizePythQuery(event.url.search)
  if (search === null) {
    return new Response("Invalid price feed request", { status: 400 })
  }

  let entry = cache.get(search)
  if (!entry || entry.expires <= Date.now()) {
    let pending = inflight.get(search)
    if (!pending) {
      pending = fetchUpstream(search, apiKey).finally(() => inflight.delete(search))
      inflight.set(search, pending)
    }
    try {
      entry = await pending
    } catch {
      return new Response("Pyth service unavailable", { status: 502 })
    }
    // Only successful responses are shared; errors are retried next request.
    if (entry.status === 200) cache.set(search, entry)
  }

  return new Response(entry.body, {
    status: entry.status,
    headers: { "Content-Type": entry.contentType, "Cache-Control": "no-store" },
  })
})
