/**
 * Reading time estimation for docs pages (DX-062).
 *
 * Compute at build time from word count:
 * - Prose words at 200 wpm
 * - Fenced code blocks at 80 wpm (slower separate rate)
 * - Inline code stripped as part of prose (not double-counted)
 *
 * Short pages hide both affordances (see HIDE thresholds).
 */

export const WORDS_PER_MINUTE_PROSE = 200
export const WORDS_PER_MINUTE_CODE = 80

/** Hide reading time + progress on pages under this length – they are noise. */
export const MIN_WORDS = 200
export const MIN_MINUTES = 2

export interface ReadingTime {
  minutes: number
  words: number
  proseWords: number
  codeWords: number
  text: string
  shouldShow: boolean
}

function countWords(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  // Split on whitespace, filter empties, ignore pure punctuation tokens
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => /[a-z0-9]/i.test(t)).length
}

export function getReadingTime(body: string): ReadingTime {
  // Extract fenced code blocks (``` ... ```) and mermaid blocks
  const fencedRe = /```[\s\S]*?```/g
  const fencedBlocks = [...body.matchAll(fencedRe)].map((m) => m[0])

  let codeWords = 0
  for (const block of fencedBlocks) {
    // Strip fences and optional language/info string
    const inner = block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "")
    codeWords += countWords(inner)
  }

  // Prose body: remove fenced blocks, then inline code, then count
  let proseBody = body.replace(fencedRe, " ")
  // Remove inline code spans `...`
  proseBody = proseBody.replace(/`[^`]*`/g, " ")
  // Remove MDX/HTML tags like <Term>, <Steps>, etc. to avoid counting tag names as words
  proseBody = proseBody.replace(/<[^>]+>/g, " ")
  // Remove markdown link/image syntax but keep text: [text](url) -> text
  proseBody = proseBody.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
  proseBody = proseBody.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  // Remove heading markers and list markers
  proseBody = proseBody.replace(/^#{1,6}\s+/gm, " ")
  proseBody = proseBody.replace(/^>\s?/gm, " ")
  proseBody = proseBody.replace(/^[-*]\s+/gm, " ")
  proseBody = proseBody.replace(/^\d+\.\s+/gm, " ")

  const proseWords = countWords(proseBody)
  const words = proseWords + codeWords

  const minutesRaw = proseWords / WORDS_PER_MINUTE_PROSE + codeWords / WORDS_PER_MINUTE_CODE
  const minutes = Math.max(1, Math.ceil(minutesRaw))

  const shouldShow = words >= MIN_WORDS && minutes >= MIN_MINUTES

  const text = minutes === 1 ? "1 min read" : `${minutes} min read`

  return { minutes, words, proseWords, codeWords, text, shouldShow }
}
