/**
 * Helpers for documentation page metadata, edit links, and date formatting (DX-045).
 */

export const GITHUB_DOCS_REPO = "https://github.com/SO4-Markets/interface"
export const GITHUB_DEFAULT_BRANCH = "main"

/**
 * Returns the GitHub edit URL for a given content page route or relative file path.
 */
export function getGitHubEditUrl(
  routeOrFile: string,
  branch = GITHUB_DEFAULT_BRANCH
): string {
  let relativePath = routeOrFile
  if (relativePath.startsWith("/")) {
    relativePath = relativePath === "/" ? "index.mdx" : `${relativePath.slice(1)}.mdx`
  }
  if (!relativePath.endsWith(".mdx") && !relativePath.endsWith(".md")) {
    relativePath += ".mdx"
  }
  if (!relativePath.startsWith("apps/docs/content/")) {
    relativePath = `apps/docs/content/${relativePath}`
  }

  return `${GITHUB_DOCS_REPO}/edit/${branch}/${relativePath}`
}

/**
 * Formats an ISO date (YYYY-MM-DD) as a human-readable relative time string.
 */
export function formatRelativeTime(
  dateStr: string,
  now: Date = new Date()
): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return dateStr

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return dateStr
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 30) return `${diffDays} days ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return "1 month ago"
  if (diffMonths < 12) return `${diffMonths} months ago`

  const diffYears = Math.floor(diffDays / 365)
  if (diffYears === 1) return "1 year ago"
  return `${diffYears} years ago`
}

/**
 * Checks if a documentation page is stale (> 180 days old).
 */
export function isPageStale(
  updatedDate: string,
  now: Date = new Date(),
  thresholdDays = 180
): boolean {
  const date = new Date(`${updatedDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return false

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays > thresholdDays
}
