import { PYTH_FEED_IDS } from "./pyth-feed-ids"

const ALLOWED_IDS = new Set(
  Object.values(PYTH_FEED_IDS).map((id) => id.replace(/^0x/, "").toLowerCase()),
)

/** Query options HermesClient sends for our call, with their only allowed values. */
const FIXED_OPTIONS: Record<string, string> = {
  encoding: "hex",
  parsed: "true",
  ignore_invalid_price_ids: "true",
}

/**
 * Validates and canonicalises a query for the server-side Hermes proxy.
 * Returns null unless every feed ID is one of the app's own feeds and every
 * other parameter is an option the app itself sends, so the public proxy can
 * only ever make a small, cacheable set of upstream requests with the paid key.
 */
export function normalizePythQuery(search: string): string | null {
  const query = new URLSearchParams(search)
  const ids: Array<string> = []
  for (const [key, value] of query) {
    if (key === "ids[]") {
      const id = value.replace(/^0x/, "").toLowerCase()
      if (!ALLOWED_IDS.has(id)) return null
      ids.push(id)
    } else if (FIXED_OPTIONS[key] !== value) {
      return null
    }
  }
  if (ids.length === 0) return null
  const normalized = new URLSearchParams()
  for (const id of [...new Set(ids)].sort()) normalized.append("ids[]", `0x${id}`)
  for (const [key, value] of Object.entries(FIXED_OPTIONS)) {
    if (query.has(key)) normalized.set(key, value)
  }
  return normalized.toString()
}
