"use client"

import { useMemo, useState } from "react"
import { SearchDialog } from "./SearchDialog"
import { DocsLayout } from "./DocsLayout"
import { DocsNavigation } from "./DocsNavigation"
import {
  getClosestPages,
  getSearchTermsFromPath,
  getSectionIndexLink,
  type PageInfo,
} from "../lib/suggestions"
import meta from "../../content/meta.json"

// Page index for suggestions — route + title derived from meta + friendly titles
// Titles mirror frontmatter where possible; fallback is humanized route.
const PAGE_TITLES: Record<string, string> = {
  "/get-started/introduction": "Introduction",
  "/get-started/quickstart": "Quickstart",
  "/developers/architecture": "Architecture",
  "/developers/local-setup": "Local Setup",
  "/developers/indexer": "Indexer",
  "/developers/contract-clients": "Contract Clients",
  "/developers/reading-data": "Reading Data",
  "/developers/writing-transactions": "Writing Transactions",
  "/developers/design-system": "Design System",
  "/developers/json-feed": "JSON Feed",
  "/concepts/order-types": "Order Types",
  "/concepts/risk": "Risk",
  "/concepts/funding-and-fees": "Funding and Fees",
  "/concepts/liquidation": "Liquidation",
  "/concepts/oracles": "Oracles",
  "/concepts/unified-liquidity": "Unified Liquidity",
  "/reference/data-store": "Data Store",
  "/reference/synthetics-reader": "Synthetics Reader",
  "/reference/order-vault": "Order Vault",
  "/reference/contracts.generated": "Contracts",
  "/reference/exchange-router": "Exchange Router",
  "/reference/graphql.generated": "GraphQL",
  "/reference/tokens.generated": "Tokens",
  "/reference/errors": "Errors",
  "/reference/glossary": "Glossary",
  "/guides/trading": "Trading",
  "/guides/positions": "Positions",
  "/guides/pools": "Pools",
  "/guides/earn": "Earn",
  "/guides/referrals": "Referrals",
  "/guides/faucet": "Faucet",
  "/guides/troubleshooting": "Troubleshooting",
  "/resources/terms": "Terms",
  "/resources/faq": "FAQ",
  "/resources/roadmap": "Roadmap",
  "/resources/changelog": "Changelog",
  "/resources/security": "Security",
  "/": "SO4 Docs",
}

const sections = (meta as { sections: Array<{ label: string; pages: string[] }> }).sections

const pageInfos: PageInfo[] = sections.flatMap((s) =>
  s.pages.map((p) => {
    const route = `/${p}`
    return { route, title: PAGE_TITLES[route] ?? p }
  })
)
// Include home
pageInfos.unshift({ route: "/", title: "SO4 Docs" })

function useRequestedPath(): string {
  // For SPA, derive from window.location; fallback to "/"
  if (typeof window !== "undefined") {
    return window.location.pathname
  }
  return "/"
}

export function NotFoundContent({ requestedPath }: { requestedPath?: string }) {
  const path = requestedPath ?? useRequestedPath()
  const [searchOpen, setSearchOpen] = useState(false)

  const suggestions = useMemo(
    () => getClosestPages(path, pageInfos, { maxSuggestions: 3 }),
    [path]
  )
  const searchTerms = useMemo(() => getSearchTermsFromPath(path), [path])
  const sectionLink = useMemo(() => getSectionIndexLink(path, sections), [path])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-3xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-3 text-sm text-text-secondary">
        No page at <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-xs">{path}</code>. Try one of these instead.
      </p>

      {suggestions.length > 0 ? (
        <section aria-labelledby="suggestions-heading" className="mt-6">
          <h2 id="suggestions-heading" className="text-sm font-semibold text-text-primary">
            Did you mean?
          </h2>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li key={s.route}>
                <a
                  href={s.route}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {s.title}
                </a>{" "}
                <span className="text-xs text-text-tertiary">{s.route}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sectionLink ? (
        <p className="mt-4 text-sm">
          <a href={sectionLink.href} className="font-medium text-primary hover:underline">
            Browse {sectionLink.label}
          </a>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="rounded-md border border-border bg-surface-canvas px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-hover"
        >
          Search docs
        </button>
        <a
          href="/"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to docs home
        </a>
      </div>

      <SearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchTerms}
      />

      {/* For static build verification: expose prefilled terms as data attribute */}
      <span data-search-prefill={searchTerms} className="hidden" aria-hidden="true" />
    </div>
  )
}

export function NotFoundPage() {
  // Build navigation for sidebar
  const navSections = sections.map((section) => ({
    label: section.label,
    pages: section.pages.map((p) => {
      const route = `/${p}`
      return { route, title: PAGE_TITLES[route] ?? p }
    }),
  }))

  return (
    <DocsLayout
      sidebar={<DocsNavigation sections={navSections} />}
      header={
        <div className="flex w-full items-center justify-between gap-4">
          <a href="/" className="text-sm font-semibold text-text-primary">
            SO4 docs
          </a>
          <a
            href="https://so4.market"
            className="text-sm font-medium text-text-link"
          >
            Open interface
          </a>
        </div>
      }
    >
      <NotFoundContent />
    </DocsLayout>
  )
}
