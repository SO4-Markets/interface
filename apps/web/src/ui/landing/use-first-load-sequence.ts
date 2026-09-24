import { useEffect, useState } from "react"

/**
 * Whether this mount is the first one since the page loaded.
 *
 * The hero entrance is a first-load sequence. A client-side navigation back to
 * the landing route mounts the hero again, but the reader has already watched
 * the sequence — replaying it reads as a content flash rather than an
 * entrance, which OB-022 calls out explicitly.
 *
 * The flag is module-scoped (one page load) and only consulted on the client:
 * the server always renders the sequencing markup, so the markup the reader
 * first paints is the markup they hydrate.
 */
let sequencedThisPageLoad = false

export function useFirstLoadSequence(): boolean {
  const [playsEntrance] = useState(() =>
    typeof window === "undefined" ? true : !sequencedThisPageLoad
  )

  useEffect(() => {
    sequencedThisPageLoad = true
  }, [])

  return playsEntrance
}
