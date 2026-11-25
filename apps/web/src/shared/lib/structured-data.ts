/**
 * schema.org structured data (JSON-LD) for individual pages (issue 954).
 *
 * Every value is read from the central site identity, so renaming the product
 * or moving the domain updates each page's structured data without touching
 * the routes that emit it. Routes attach the result through their `head()`
 * `scripts`, which keeps each schema on the page whose content it describes:
 * `Organization` on `/`, `FAQPage` on `/referrals`.
 */
import {
  ORGANIZATION_NAME,
  SITE_DESCRIPTION,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_URL,
  SOCIAL_URLS,
} from "./site-identity"

export type JsonLd = { "@context": "https://schema.org" } & Record<string, unknown>

export type StructuredFaq = {
  question: string
  answer: string
}

export const ORGANIZATION_ID = `${SITE_URL}/#org`
export const WEBSITE_ID = `${SITE_URL}/#website`

/** The site itself: every page belongs to it. */
export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
  }
}

/** The organisation behind the product, published on the landing page. */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    logo: SITE_LOGO_URL,
    sameAs: [SOCIAL_URLS.x, SOCIAL_URLS.discord, SOCIAL_URLS.telegram, SOCIAL_URLS.github],
  }
}

/** The trading application, published on the landing page next to its publisher. */
export function webApplicationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    publisher: { "@id": ORGANIZATION_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  }
}

/**
 * A `FAQPage` for questions rendered on the page. Google only accepts FAQ
 * markup that mirrors visible content, so pass the exact items on screen.
 */
export function faqPageJsonLd(
  pageUrl: string,
  items: ReadonlyArray<StructuredFaq>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}

/**
 * JSON for an inline `<script type="application/ld+json">`. `<` is escaped so
 * no string value (an FAQ answer, a future CMS field) can close the script
 * element early; JSON parsers read `<` back as `<`.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

/** A route `head().scripts` entry carrying one JSON-LD document. */
export function jsonLdScript(data: JsonLd) {
  return { type: "application/ld+json", children: serializeJsonLd(data) }
}
