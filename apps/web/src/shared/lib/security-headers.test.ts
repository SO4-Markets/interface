import { describe, expect, it } from "vitest"
import { STATIC_SECURITY_HEADERS, buildContentSecurityPolicy } from "./security-headers"
import type { CspEndpoints } from "./security-headers"

const ENDPOINTS: CspEndpoints = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  oracleUrl: "https://oracle.example.com",
  hermesUrl: "https://hermes.pyth.network",
  indexerUrl: "https://indexer.example.com/graphql",
}

/** Extracts one directive (e.g. "connect-src") from a policy string. */
function directive(policy: string, name: string): string {
  const match = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  return match ?? ""
}

describe("static security headers", () => {
  it("denies framing, MIME sniffing and referrer leakage", () => {
    expect(STATIC_SECURITY_HEADERS["x-frame-options"]).toBe("DENY")
    expect(STATIC_SECURITY_HEADERS["x-content-type-options"]).toBe("nosniff")
    expect(STATIC_SECURITY_HEADERS["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  })

  it("locks down powerful browser features and enforces HSTS", () => {
    const permissions = STATIC_SECURITY_HEADERS["permissions-policy"]
    expect(permissions).toContain("camera=()")
    expect(permissions).toContain("microphone=()")
    expect(permissions).toContain("geolocation=()")
    expect(STATIC_SECURITY_HEADERS["strict-transport-security"]).toContain("max-age=")
    expect(STATIC_SECURITY_HEADERS["cross-origin-opener-policy"]).toBe(
      "same-origin-allow-popups",
    )
  })
})

describe("buildContentSecurityPolicy", () => {
  it("nonces inline scripts instead of allowing 'unsafe-inline'", () => {
    const policy = buildContentSecurityPolicy("abc123", ENDPOINTS)
    const scriptSrc = directive(policy, "script-src")

    expect(scriptSrc).toContain("'nonce-abc123'")
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it("refuses framing and object embedding anywhere", () => {
    const policy = buildContentSecurityPolicy("abc123", ENDPOINTS)

    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'")
    expect(directive(policy, "object-src")).toBe("object-src 'none'")
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'")
  })

  it("allow-lists every configured and hard-coded runtime endpoint", () => {
    const policy = buildContentSecurityPolicy("abc123", ENDPOINTS)
    const connectSrc = directive(policy, "connect-src")

    for (const origin of [
      "'self'",
      "https://soroban-testnet.stellar.org",
      "https://horizon-testnet.stellar.org",
      "https://oracle.example.com",
      "https://hermes.pyth.network",
      "https://indexer.example.com",
      "https://arbitrum-api.gmxinfra.io",
      "https://oracle.biscotti-proxy-worker.workers.dev",
      "https://api.binance.com",
      "wss://stream.binance.com:9443",
      "https://benchmarks.pyth.network",
    ]) {
      expect(connectSrc).toContain(origin)
    }
  })

  it("reduces configured URLs to origins and drops invalid ones", () => {
    const policy = buildContentSecurityPolicy("abc123", {
      ...ENDPOINTS,
      indexerUrl: "not a url",
      rpcUrl: "https://rpc.example.com/soroban/rpc?key=secret",
    })
    const connectSrc = directive(policy, "connect-src")

    expect(connectSrc).toContain("https://rpc.example.com")
    expect(connectSrc).not.toContain("key=secret")
    expect(connectSrc).not.toContain("not a url")
  })

  it("does not duplicate origins when the configured value is a default", () => {
    const policy = buildContentSecurityPolicy("abc123", {
      ...ENDPOINTS,
      oracleUrl: "https://arbitrum-api.gmxinfra.io",
    })
    const occurrences = directive(policy, "connect-src")
      .split(" ")
      .filter((source) => source === "https://arbitrum-api.gmxinfra.io")

    expect(occurrences).toHaveLength(1)
  })

  it("allow-lists wallet icon and Albedo frame hosts", () => {
    const policy = buildContentSecurityPolicy("abc123", ENDPOINTS)

    expect(directive(policy, "img-src")).toContain("https://stellar.creit.tech")
    expect(directive(policy, "img-src")).toContain("https://uni.onekey-asset.com")
    expect(directive(policy, "img-src")).toContain("https://cdn.jsdelivr.net")
    expect(directive(policy, "img-src")).toContain("https://api.dicebear.com")
    expect(directive(policy, "frame-src")).toContain("https://albedo.link")
  })

  it("is deterministic for a given nonce and endpoint set", () => {
    expect(buildContentSecurityPolicy("abc123", ENDPOINTS)).toBe(
      buildContentSecurityPolicy("abc123", ENDPOINTS),
    )
  })
})
