import { expect, test } from "@playwright/test"
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Security headers end-to-end coverage.
 *
 * Exercises the built production output (not the dev server, where the strict
 * policy is intentionally disabled because Vite injects its own inline
 * scripts):
 * - Static headers (X-Frame-Options, nosniff, Referrer-Policy,
 *   Permissions-Policy, HSTS) on HTML routes and on static assets.
 * - The per-request Content-Security-Policy on "/" and "/trade", including
 *   the nonce gate on script-src.
 * - Every inline script in the served HTML carrying the response's nonce.
 * - A browser session under the policy: theme guard runs, hydration and
 *   client-side navigation work, and no CSP violation is reported.
 *
 * Rules:
 * - Runs against built output. The CI e2e job builds apps/web before running
 *   the suite; when the output is missing locally the spec builds it first.
 * - Zero arbitrary sleeps — waits on assertions and server readiness polling.
 */

// The suite owns one production server on a fixed port, so the file must run
// sequentially in a single worker — parallel workers would race to bind the
// same port and could tear the server down mid-run.
test.describe.configure({ mode: "serial" })

const SECURITY_PORT = 3006
const BASE_URL = `http://127.0.0.1:${SECURITY_PORT}`
const HTML_ROUTES = ["/", "/trade"]

let serverProcess: ChildProcess | null = null

/** Extracts one directive (e.g. "connect-src") from a CSP header value. */
function directive(policy: string, name: string): string {
  return (
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `)) ?? ""
  )
}

test.beforeAll(async () => {
  test.setTimeout(300_000)

  const root = process.cwd()
  const serverScript = join(root, "apps", "web", ".output", "server", "index.mjs")

  if (!existsSync(serverScript)) {
    const build = spawnSync(
      "bun",
      ["run", "build", "--", "--mode", "testnet"],
      { cwd: join(root, "apps", "web"), stdio: "inherit" },
    )
    expect(build.status, "apps/web production build must succeed").toBe(0)
  }

  // The Bun/Nitro output must run under Bun (it is built with Bun-only server
  // primitives), so spawn it with `bun`, not `node`.
  serverProcess = spawn("bun", [serverScript], {
    env: { ...process.env, PORT: String(SECURITY_PORT), HOST: "127.0.0.1" },
    stdio: "ignore",
  })

  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`, { headers: { accept: "text/html" } })
      if (res.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`web production server did not become ready on ${BASE_URL}`)
})

test.afterAll(() => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})

for (const path of HTML_ROUTES) {
  test.describe(`security headers on ${path}`, () => {
    test("sends static hardening headers", async ({ request }) => {
      const res = await request.get(`${BASE_URL}${path}`)
      expect(res.status()).toBe(200)

      const headers = res.headers()
      expect(headers["x-content-type-options"]).toBe("nosniff")
      expect(headers["x-frame-options"]).toBe("DENY")
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
      expect(headers["permissions-policy"]).toContain("camera=()")
      expect(headers["strict-transport-security"]).toContain("max-age=")
    })

    test("sends a nonce-gated Content-Security-Policy", async ({ request }) => {
      const res = await request.get(`${BASE_URL}${path}`)
      const csp = res.headers()["content-security-policy"] ?? ""

      expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'")
      expect(directive(csp, "object-src")).toBe("object-src 'none'")
      expect(directive(csp, "default-src")).toBe("default-src 'self'")

      const scriptSrc = directive(csp, "script-src")
      expect(scriptSrc).toMatch(/'nonce-[a-f0-9]{32}'/)
      expect(scriptSrc).not.toContain("'unsafe-inline'")
      expect(scriptSrc).not.toContain("'unsafe-eval'")

      // Runtime endpoints the app talks to from the browser.
      const connectSrc = directive(csp, "connect-src")
      for (const origin of [
        "https://soroban-testnet.stellar.org",
        "https://horizon-testnet.stellar.org",
        "https://hermes.pyth.network",
        "https://benchmarks.pyth.network",
        "https://api.binance.com",
        "wss://stream.binance.com:9443",
        "https://arbitrum-api.gmxinfra.io",
        "https://oracle.biscotti-proxy-worker.workers.dev",
      ]) {
        expect(connectSrc).toContain(origin)
      }

      const imgSrc = directive(csp, "img-src")
      expect(imgSrc).toContain("https://stellar.creit.tech")
      expect(imgSrc).toContain("https://uni.onekey-asset.com")

      expect(directive(csp, "frame-src")).toContain("https://albedo.link")
    })

    test("nonces every inline script in the document", async ({ request }) => {
      const res = await request.get(`${BASE_URL}${path}`)
      const csp = res.headers()["content-security-policy"] ?? ""
      const nonce = directive(csp, "script-src").match(/'nonce-([a-f0-9]+)'/)?.[1]
      expect(nonce, "CSP must carry a nonce").toBeTruthy()

      const html = await res.text()
      const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].map(
        (match) => match[0],
      )

      expect(inlineScripts.length, "page must render inline scripts").toBeGreaterThan(0)
      for (const tag of inlineScripts) {
        expect(tag, `inline script without nonce: ${tag}`).toContain(`nonce="${nonce}"`)
      }
    })

    test("uses a fresh nonce per response", async ({ request }) => {
      const nonces = await Promise.all([0, 1].map(async () => {
        const res = await request.get(`${BASE_URL}${path}`)
        return directive(res.headers()["content-security-policy"] ?? "", "script-src").match(
          /'nonce-([a-f0-9]+)'/,
        )?.[1]
      }))

      expect(nonces[0]).toBeTruthy()
      expect(nonces[0]).not.toBe(nonces[1])
    })
  })
}

test("serves static hardening headers on built assets", async ({ request }) => {
  const page = await request.get(`${BASE_URL}/`)
  const html = await page.text()
  const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1]

  if (assetPath) {
    const asset = await request.get(`${BASE_URL}${assetPath}`)
    expect(asset.status()).toBe(200)
    expect(asset.headers()["x-content-type-options"]).toBe("nosniff")
    expect(asset.headers()["x-frame-options"]).toBe("DENY")
  }
})

test("runs the app under the policy without CSP violations", async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __cspViolations: unknown[] }).__cspViolations = []
    document.addEventListener("securitypolicyviolation", (event) => {
      ;(window as unknown as { __cspViolations: unknown[] }).__cspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
      })
    })
  })

  await page.goto(`${BASE_URL}/`)
  await page.waitForLoadState("domcontentloaded")

  // The inline theme guard ran before paint and the router hydrated.
  await expect(page.locator("html")).toHaveClass(/(dark|light)/)

  // Hydration check: an in-app link must produce a soft navigation, which
  // requires the client bundle (allowed by 'self') and the router runtime to
  // be live. A sentinel on window survives only when the document is reused.
  await page.evaluate(() => {
    ;(window as unknown as { __cspSoftNav?: boolean }).__cspSoftNav = true
  })
  await page.getByRole("link", { name: "Trade", exact: true }).first().click()
  await expect(page).toHaveURL(`${BASE_URL}/trade`)
  expect(
    await page.evaluate(() => (window as unknown as { __cspSoftNav?: boolean }).__cspSoftNav),
  ).toBe(true)

  // The trade workspace (charts, orderbook, market-data stream) is the
  // client-heaviest route; let it mount so any violation it would trigger has
  // been reported before asserting the policy was never breached.
  await expect(page.getByRole("button", { name: "BTC/USD" })).toBeVisible()
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: unknown[] }).__cspViolations,
  )
  expect(violations).toEqual([])
})
