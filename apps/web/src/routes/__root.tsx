import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { Home01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@workspace/ui/components/icon"
import { ToastProvider } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { DensityProvider } from "@workspace/ui/components/density-provider"
import appCss from "@workspace/ui/globals.css?url"
import geistLatinFont from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url"
import { ENV } from "../app/config/env"
import { buildResourceHints } from "../shared/lib/resource-hints"
import { AppProviders } from "../app/providers"
import { SITE_NAME, SITE_URL, SOCIAL_URLS } from "../shared/lib/site-identity"
import { RouteAnnouncer } from "../shared/components/RouteAnnouncer"
import { RouteProgressBar } from "../shared/components/RouteProgressBar"
import { useCspNonce } from "../shared/lib/csp-nonce"
import { installWebVitalsReporting } from "@/features/observability/lib/web-vitals"

const TITLE = `${SITE_NAME} · On-chain perpetuals`
const DESCRIPTION =
  "A unified-liquidity perp DEX. Deep books, sub-second matching, and self-custodied risk — built for traders who care where their fills come from."
// TODO(GF3-003): apply the dot-separator convention (no em dashes as list
// separators, "." between clauses — e.g. "Trade · Long/Short") through the
// rest of the landing copy pass. This file's list-style SEO strings (title,
// OG/Twitter image alt) are fixed now since they're the page's actual SEO
// surface; DESCRIPTION's dash is a genuine sentence break, not a list
// separator, and stays.
const OG_IMAGE = `${SITE_URL}/og-image.webp`
const TWITTER_HANDLE = "@so4market"

// JSON-LD structured data (WebApplication + FinancialService)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "SO4 Markets",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
      sameAs: [
        SOCIAL_URLS.x,
        SOCIAL_URLS.discord,
        SOCIAL_URLS.telegram,
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },

      // ── Core SEO ────────────────────────────────────────────────
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "perpetual DEX, on-chain perps, crypto derivatives, DeFi trading, BTC perp, ETH perp, low fee perp, self-custodied trading, unified liquidity",
      },
      { name: "author", content: "SO4 Markets" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      // ds-allow: <meta content> requires a literal color string for
      // mobile browser chrome tinting — can't reference a CSS custom
      // property here, so it can't be sourced from the token system.
      { name: "theme-color", content: "#111126" },
      { name: "color-scheme", content: "dark light" },
      // Prevents phone number detection on iOS / Android WebView
      { name: "format-detection", content: "telephone=no" },

      // ── Open Graph ──────────────────────────────────────────────
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_US" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/webp" },
      {
        property: "og:image:alt",
        content:
          `${SITE_NAME} · On-chain perpetuals DEX · unified liquidity for modern markets`,
      },

      // ── Twitter / X Card ────────────────────────────────────────
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: TWITTER_HANDLE },
      { name: "twitter:creator", content: TWITTER_HANDLE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
      {
        name: "twitter:image:alt",
        content:
          `${SITE_NAME} · On-chain perpetuals DEX · unified liquidity for modern markets`,
      },
    ],
    links: [
      // ── Icons ───────────────────────────────────────────────────
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },

      // ── Canonical ───────────────────────────────────────────────
      { rel: "canonical", href: SITE_URL },

      // ── Connection hints (#929) ─────────────────────────────────
      ...buildResourceHints({
        rpcUrl: ENV.RPC_URL,
        horizonUrl: ENV.HORIZON_URL,
        pythHermesUrl: ENV.PYTH_HERMES_URL,
      }),

      // ── Fonts (#930): only the Geist face used above the fold ──
      {
        rel: "preload",
        href: geistLatinFont,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },

      // ── App CSS ─────────────────────────────────────────────────
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
  shellComponent: RootDocument,
})

const NOT_FOUND_DESTINATIONS = [
  { label: "Markets", description: "Find a market to trade", to: "/trade" },
  { label: "Liquidity pools", description: "Explore pool performance", to: "/pools" },
  { label: "Earn", description: "Manage staking and rewards", to: "/earn" },
  { label: "Referrals", description: "View your referral program", to: "/referrals" },
] as const

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-330 items-center px-4 py-10 md:px-8">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-16">
        <section className="max-w-3xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-moderate">
          <p className="font-mono text-xs text-text-tertiary">SO4 / ROUTE NOT FOUND</p>
          <p aria-hidden="true" className="mt-8 font-mono text-8xl leading-none text-text-tertiary/40 md:text-9xl">
            404
          </p>
          <h1 className="mt-6 text-3xl font-semibold text-text-primary sm:text-4xl">
            Page not found.
          </h1>
          <p className="mt-3 max-w-lg text-base text-text-secondary">
            This route isn’t on the map. It may have moved, or the address may be
            mistyped.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none"
            >
              <Icon icon={Home01Icon} size="sm" aria-hidden="true" />
              Back to home
            </Link>
            <Link
              to="/trade"
              className="inline-flex min-h-11 items-center rounded-sm border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-interactive motion-reduce:transition-none"
            >
              Browse markets
            </Link>
          </div>
        </section>

        <nav
          aria-labelledby="not-found-destinations"
          className="rounded-lg border border-border bg-surface-raised p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-moderate"
        >
          <h2 id="not-found-destinations" className="text-sm font-semibold text-text-primary">
            Useful destinations
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {NOT_FOUND_DESTINATIONS.map((destination) => (
              <li key={destination.to}>
                <Link
                  to={destination.to}
                  className="-mx-2 flex min-h-14 items-center justify-between gap-4 rounded-sm px-2 py-2 transition-colors hover:bg-surface-interactive motion-reduce:transition-none"
                >
                  <span>
                    <span className="block text-sm font-medium text-text-primary">
                      {destination.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">
                      {destination.description}
                    </span>
                  </span>
                  <span aria-hidden="true" className="font-mono text-sm text-text-tertiary">
                    /{destination.to.slice(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  )
}

// Sits above every route so the post-navigation focus/announcement handoff
// (DS-078) is installed exactly once, inside router context.
function RootComponent() {
  useEffect(() => installWebVitalsReporting(), [])
  return (
    <>
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}

// Minified blocking script — runs synchronously before first paint.
// Reads localStorage and sets dark/light class on <html> so CSS variables
// resolve correctly before React hydrates. Prevents the flash of wrong theme.
const THEME_SCRIPT =
  `(function(){try{var t=localStorage.getItem('so4-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.add(d?'dark':'light')}catch(e){}})()` as const

function RootDocument({ children }: { children: React.ReactNode }) {
  // Nonce for the document's inline scripts under the strict CSP. React and
  // the router already thread it through their own script tags; these two are
  // hand-rendered (theme flash guard, JSON-LD), so they need it explicitly.
  const nonce = useCspNonce()

  return (
    // suppressHydrationWarning: the blocking script adds a class before React
    // hydrates, so the server-rendered HTML and client DOM will differ on the
    // class attribute of <html>. This suppresses the expected mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must be first — runs before any CSS is applied */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <DensityProvider>
          <AppProviders>
            <TooltipProvider delay={500} timeout={400} closeDelay={0}>
              <ToastProvider>
                <RouteProgressBar />
                {children}
              </ToastProvider>
            </TooltipProvider>
          </AppProviders>
        </DensityProvider>
        <Scripts />
      </body>
    </html>
  )
}