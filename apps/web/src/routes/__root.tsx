import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { Toaster } from "sonner"
import { AppProviders } from "@/app/providers"
import appCss from "@workspace/ui/globals.css?url"
import { ThemeProvider } from "../ui/theme-provider"
import { NetworkMismatchBanner } from "../features/wallet/components/NetworkMismatchBanner"
import { WalletProvider } from "../app/providers"


// Update this to your production domain before going live.
const SITE_URL = "https://so4.market"
const SITE_NAME = "so4.market"
const TITLE = "SO4 — On-chain perpetuals"
const DESCRIPTION =
  "A unified-liquidity perp DEX. Deep books, sub-second matching, and self-custodied risk — built for traders who care where their fills come from."
const OG_IMAGE = `${SITE_URL}/og-image.svg`
const TWITTER_HANDLE = "@so4market"

// JSON-LD structured data (WebApplication + FinancialService)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "SO4",
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
      name: "so4 labs",
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
      { name: "author", content: "so4 labs" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "theme-color", content: "#0A0B0D" },
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
        content: "SO4 — On-chain perpetuals DEX · $8.42B 24h volume · 184 markets",
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
        content: "SO4 — On-chain perpetuals DEX · $8.42B 24h volume · 184 markets",
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

      // ── Fonts ───────────────────────────────────────────────────
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&display=swap",
      },

      // ── App CSS ─────────────────────────────────────────────────
      { rel: "stylesheet", href: appCss },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-330 p-4 pt-16">
      <h1 className="text-2xl font-medium text-foreground">404</h1>
      <p className="mt-2 text-muted-foreground">The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

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
        <AppProviders>
          {children}
          <Toaster richColors position="bottom-right" />
        </AppProviders>
        <Scripts />
      </body>
    </html>
  )
}
