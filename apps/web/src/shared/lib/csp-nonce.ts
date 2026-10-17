import { useRouter } from "@tanstack/react-router"

/**
 * Returns the CSP nonce for the current document, or undefined when no strict
 * policy is active (dev server).
 *
 * During SSR the nonce is the per-request value generated in src/server.ts and
 * attached to the router, which is also what React and the router stamp onto
 * the inline scripts they emit. After hydration the router no longer carries
 * it, so it is read back from the `csp-nonce` meta tag that HeadContent renders
 * alongside it. Both paths return the same string, so server and client renders
 * of nonce-carrying tags (theme script, JSON-LD) agree.
 */
export function useCspNonce(): string | undefined {
  const router = useRouter()
  const routerNonce = router.options.ssr?.nonce
  if (routerNonce) return routerNonce
  if (typeof document === "undefined") return undefined
  return (
    document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content ??
    undefined
  )
}
