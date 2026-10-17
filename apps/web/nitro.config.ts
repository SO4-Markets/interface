import { defineNitroConfig } from "nitro/config"
import { getNitroRouteRules } from "./src/shared/lib/cache-headers"
import { STATIC_SECURITY_HEADERS } from "./src/shared/lib/security-headers"

// Security headers are merged into every route rule rather than declared once
// on "/**": Nitro resolves overlapping route rules per pattern, so rule sets
// like "/**/*.png" replace the wildcard entry's headers instead of inheriting
// them, and a single "/**" rule would leave those responses uncovered. The
// per-request Content-Security-Policy is set in src/server.ts, where the nonce
// is available.
const routeRules = Object.fromEntries(
  Object.entries(getNitroRouteRules()).map(([pattern, rule]) => [
    pattern,
    { ...rule, headers: { ...STATIC_SECURITY_HEADERS, ...rule.headers } },
  ]),
)

export default defineNitroConfig({
  routeRules,
})
