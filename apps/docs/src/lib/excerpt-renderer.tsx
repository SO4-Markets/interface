import React from "react"

function decodeExcerptEntities(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
}

/**
 * Safely render a Pagefind excerpt by splitting on <mark> tags and building React elements.
 * This prevents HTML injection while preserving the search result highlighting.
 */
export function renderExcerpt(excerpt: string): React.ReactNode {
  const parts = excerpt.split(/(<mark>|<\/mark>)/)
  let inMark = false
  const elements: React.ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part === "<mark>") {
      inMark = true
    } else if (part === "</mark>") {
      inMark = false
    } else if (part) {
      const text = decodeExcerptEntities(part)

      if (inMark) {
        elements.push(
          <mark key={`mark-${i}`} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
            {text}
          </mark>,
        )
      } else {
        elements.push(text)
      }

    }
  }

  return <>{elements}</>
}

/**
 * Test helper: render excerpt and extract plain text for testing
 */
export function getExcerptText(excerpt: string): string {
  return decodeExcerptEntities(excerpt
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, ""))
}
