import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { ToastProvider } from "@workspace/ui/components/toast"
import { DensityProvider } from "@workspace/ui/components/density-provider"
import appCss from "@workspace/ui/globals.css?url"
import { AppProviders } from "../app/providers"
import { RouteAnnouncer } from "../shared/components/RouteAnnouncer"

// Update this to your production domain before going live.
const SITE_URL = "https://levee.market"
const SITE_NAME = "levee.market"
const TITLE = "Levee · On-chain perpetuals"
const DESCRIPTION =
  "A unified-liquidity perp DEX. Deep books, sub-second matching, and self-custodied risk — built for traders who care where their fills come from."
// TODO(GF3-003): apply the dot-separator convention (no em dashes as list
// separators, "." between clauses — e.g. "Trade · Long/Short") through the
// rest of the landing copy pass. This file's list-style SEO strings (title,
// OG/Twitter image alt) are fixed now since they're the page's actual SEO
// surface; DESCRIPTION's dash is a genuine sentence break, not a list
// separator, and stays.
const OG_IMAGE = `${SITE_URL}/og-image.svg`
const TWITTER_HANDLE = "@so4market"

// JSON-LD structured data (WebApplication + FinancialService)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Levee",
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
      name: "Levee Labs",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
      sameAs: [
        "https://twitter.com/so4market",
        "https://discord.gg/so4market",
        "https://t.me/so4market",
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
      { name: "author", content: "Levee Labs" },
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
      { property: "og:image:type", content: "image/svg+xml" },
      {
        property: "og:image:alt",
        content:
          "Levee · On-chain perpetuals DEX · unified liquidity for modern markets",
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
          "Levee · On-chain perpetuals DEX · unified liquidity for modern markets",
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

      // ── DNS Prefetch ────────────────────────────────────────────
      { rel: "dns-prefetch", href: "//indexer.example.com" },
      { rel: "dns-prefetch", href: "//rpc.example.com" },

      // ── Preload Critical Assets ─────────────────────────────────
      {
        rel: "preload",
        as: "font",
        href: "/fonts/inter-400.woff2",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        href: "/fonts/inter-600.woff2",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },

      // ── App CSS ─────────────────────────────────────────────────
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-330 p-4 pt-16">
      <h1 className="text-2xl font-medium text-foreground">404</h1>
      <p className="mt-2 text-muted-foreground">
        The requested page could not be found.
      </p>
      <div className="mt-4">
        <Link to="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    </main>
  ),
  component: RootComponent,
  shellComponent: RootDocument,
})

// Sits above every route so the post-navigation focus/announcement handoff
// (DS-078) is installed exactly once, inside router context.
function RootComponent() {
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
  return (
    // suppressHydrationWarning: the blocking script adds a class before React
    // hydrates, so the server-rendered HTML and client DOM will differ on the
    // class attribute of <html>. This suppresses the expected mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must be first — runs before any CSS is applied */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <DensityProvider>
          <AppProviders>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AppProviders>
        </DensityProvider>
        <Scripts />
      </body>
    </html>
  )
}
