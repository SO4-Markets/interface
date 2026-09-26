/**
 * Suggestion logic for 404 page (DX-049).
 * Uses Levenshtein distance over page index, capped and thresholded.
 */

export interface PageInfo {
  route: string
  title: string
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

export function normalizedDistance(a: string, b: string): number {
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 0 : dist / maxLen
}

export interface SuggestionOptions {
  maxSuggestions?: number
  maxDistance?: number
  maxNormalized?: number
}

const DEFAULT_MAX_SUGGESTIONS = 3
const DEFAULT_MAX_DISTANCE = 10
const DEFAULT_MAX_NORMALIZED = 0.6

export function getClosestPages(
  requestedPath: string,
  pages: PageInfo[],
  opts: SuggestionOptions = {}
): PageInfo[] {
  const maxSuggestions = opts.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE
  const maxNormalized = opts.maxNormalized ?? DEFAULT_MAX_NORMALIZED

  // Normalize requested path: lower, trim trailing slash, ensure leading /
  const req = requestedPath.toLowerCase().replace(/\/+$/, "") || "/"
  if (pages.length === 0) return []

  const scored = pages
    .map((p) => {
      const route = p.route.toLowerCase()
      const dist = levenshtein(req, route)
      const norm = normalizedDistance(req, route)
      // Also consider path segments: if req shares prefix, boost
      const isPrefix = route.startsWith(req) || req.startsWith(route)
      const adjustedDist = isPrefix ? dist * 0.7 : dist
      const adjustedNorm = isPrefix ? norm * 0.7 : norm
      return { page: p, dist: adjustedDist, norm: adjustedNorm, rawDist: dist }
    })
    .filter((s) => s.dist <= maxDistance && s.norm <= maxNormalized)
    .sort((a, b) => a.dist - b.dist || a.norm - b.norm)
    .slice(0, maxSuggestions)
    .map((s) => s.page)

  return scored
}

export function getSearchTermsFromPath(path: string): string {
  // Turn /concepts/order-types -> "concepts order types"
  // Also handle kebab, snake, camel
  const withoutQuery = path.split("?")[0].split("#")[0]
  const segments = withoutQuery.split("/").filter(Boolean)
  const terms = segments
    .join(" ")
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
  return terms.trim()
}

export function getSectionIndexLink(
  requestedPath: string,
  sections: Array<{ label: string; pages: string[] }>
): { label: string; href: string } | null {
  const req = requestedPath.toLowerCase().replace(/\/+$/, "")
  const firstSegment = req.split("/").filter(Boolean)[0]
  if (!firstSegment) return null
  for (const section of sections) {
    const prefix = firstSegment
    // Check if any page in section starts with this prefix
    const hasPrefix = section.pages.some((p) => p.toLowerCase().startsWith(prefix))
    if (hasPrefix && section.pages.length > 0) {
      const label = section.label
      const href = `/${section.pages[0]}`
      return { label, href }
    }
  }
  return null
}
