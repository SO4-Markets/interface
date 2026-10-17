import React from "react"

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
      // Escape the text to prevent any HTML injection
      const escapedText = part
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;") // ds-allow: HTML character reference, not a hex color

      if (inMark) {
        elements.push(
          <mark key={`mark-${i}`} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
            {escapedText}
          </mark>,
        )
      } else {
        elements.push(escapedText)
      }
    }
  }

  return <>{elements}</>
}

/**
 * Test helper: render excerpt and extract plain text for testing
 */
export function getExcerptText(excerpt: string): string {
  return excerpt
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'") // ds-allow: HTML character reference, not a hex color
}
