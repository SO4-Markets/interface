/** Canonical origin of the documentation site. Used for canonical/OG URLs and
 * by the static generator for the print-only page footer (DX-063). */
export const DEFAULT_SITE_URL = "https://docs.so4.market"

export interface SeoMetadataOptions {
  title: string
  description: string
  route: string
  updated: string
  section?: string
  siteUrl?: string
}

export function generateSeoTags({
  title,
  description,
  route,
  updated,
  section = "Documentation",
  siteUrl = DEFAULT_SITE_URL,
}: SeoMetadataOptions): { headTags: string; structuredDataHtml: string } {
  const fullTitle = `${title} · SO4 docs`
  const canonicalUrl = `${siteUrl}${route}`
  const ogImageUrl = `${siteUrl}/og${route === "/" ? "/index" : route}.svg`

  const escapeAttr = (val: string) =>
    val.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const headTags = [
    `<title>${escapeAttr(fullTitle)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:site_name" content="SO4 Documentation">`,
    `<meta property="og:title" content="${escapeAttr(fullTitle)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(ogImageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(fullTitle)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(ogImageUrl)}">`,
  ].join("\n    ")

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description: description,
    dateModified: updated,
    url: canonicalUrl,
    articleSection: section,
    publisher: {
      "@type": "Organization",
      name: "SO4 Market",
      url: "https://so4.market",
    },
    author: {
      "@type": "Organization",
      name: "SO4 Market",
    },
  }

  const structuredDataHtml = `<script type="application/ld+json">\n${JSON.stringify(structuredData, null, 2)}\n</script>`

  return { headTags, structuredDataHtml }
}
