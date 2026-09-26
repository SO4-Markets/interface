/** DX-061: cookieless "was this helpful" page feedback.
 *
 * A submission stores exactly four fields — page path, verdict, an optional
 * redacted comment, and a coarse (day-granularity) timestamp. Nothing here
 * reads a cookie, an IP address, or any other per-visitor identifier.
 */

export type FeedbackVerdict = "yes" | "no"

export interface FeedbackRecord {
  path: string
  verdict: FeedbackVerdict
  comment: string | null
  day: string
}

const REDACTED = "[redacted]"
const MAX_COMMENT_LENGTH = 500
const MAX_PATH_LENGTH = 200

/** Stellar/Soroban strkeys (accounts "G", contracts "C", secret seeds "S"),
 * EVM-style hex addresses, 32-byte hex strings (transaction hashes and raw
 * keys share this shape, so both are treated as sensitive), and emails. */
const SENSITIVE_PATTERNS: Array<RegExp> = [
  /\b[GCS][A-Z2-7]{55}\b/g,
  /\b0x[a-fA-F0-9]{40}\b/g,
  /\b[a-fA-F0-9]{64}\b/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
]

export function redactSensitive(input: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, REDACTED),
    input,
  )
}

export function isValidPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
    /^\/[a-z0-9/-]*$/.test(path)
  )
}

export function isValidVerdict(verdict: unknown): verdict is FeedbackVerdict {
  return verdict === "yes" || verdict === "no"
}

/** A coarse, day-granularity timestamp — never the exact submission time. */
export function coarseDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Validates and normalises a raw request body into a storable record, or
 * returns null if the submission is malformed. Comments are trimmed, capped,
 * and redacted before they reach the caller. */
export function parseFeedbackSubmission(
  body: unknown,
  now: Date = new Date(),
): FeedbackRecord | null {
  if (typeof body !== "object" || body === null) return null
  const { path, verdict, comment } = body as Record<string, unknown>

  if (!isValidPath(path) || !isValidVerdict(verdict)) return null
  if (comment !== undefined && typeof comment !== "string") return null

  const trimmed =
    typeof comment === "string" ? comment.trim().slice(0, MAX_COMMENT_LENGTH) : ""
  const redacted = trimmed.length > 0 ? redactSensitive(trimmed) : ""

  return {
    path,
    verdict,
    comment: redacted.length > 0 ? redacted : null,
    day: coarseDay(now),
  }
}

/** Maps a page path to a flat storage key, e.g. "/concepts/risk" → "concepts-risk". */
export function feedbackStorageKey(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, "")
  return trimmed.length > 0 ? trimmed.replaceAll("/", "-") : "index"
}
