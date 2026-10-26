/**
 * Development-only diagnostic logging. Compiles to a no-op in production
 * builds so wallet addresses and endpoint details never reach end users'
 * consoles (or browser extensions that read them).
 */
export function debugLog(...args: Array<unknown>): void {
  if (import.meta.env.DEV) console.debug(...args)
}
