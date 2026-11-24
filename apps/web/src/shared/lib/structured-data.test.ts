import { describe, expect, it } from "vitest"
import {
  ORGANIZATION_NAME,
  SITE_DESCRIPTION,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_URL,
  SOCIAL_URLS,
} from "./site-identity"
import {
  ORGANIZATION_ID,
  faqPageJsonLd,
  jsonLdScript,
  organizationJsonLd,
  serializeJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from "./structured-data"

describe("structured data (issue 954)", () => {
  it("builds the Organization from the central site identity", () => {
    expect(organizationJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: ORGANIZATION_NAME,
      url: SITE_URL,
      logo: SITE_LOGO_URL,
      sameAs: [SOCIAL_URLS.x, SOCIAL_URLS.discord, SOCIAL_URLS.telegram, SOCIAL_URLS.github],
    })
  })

  it("links the WebApplication to its publisher and describes the WebSite", () => {
    expect(webApplicationJsonLd()).toMatchObject({
      "@type": "WebApplication",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": ORGANIZATION_ID },
    })
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      url: SITE_URL,
      name: SITE_NAME,
    })
  })

  it("maps visible FAQ items into FAQPage questions in order", () => {
    const data = faqPageJsonLd(`${SITE_URL}/referrals`, [
      { question: "Q1?", answer: "A1." },
      { question: "Q2?", answer: "A2." },
    ])
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url: `${SITE_URL}/referrals`,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: [
        { "@type": "Question", name: "Q1?", acceptedAnswer: { "@type": "Answer", text: "A1." } },
        { "@type": "Question", name: "Q2?", acceptedAnswer: { "@type": "Answer", text: "A2." } },
      ],
    })
  })

  it("escapes '<' so a value cannot close the inline script", () => {
    const data = faqPageJsonLd(SITE_URL, [
      { question: "</script><script>alert(1)</script>", answer: "a < b" },
    ])
    const serialized = serializeJsonLd(data)
    expect(serialized).not.toContain("<")
    expect(JSON.parse(serialized)).toEqual(data)
  })

  it("wraps a document as an ld+json head script", () => {
    const script = jsonLdScript(websiteJsonLd())
    expect(script.type).toBe("application/ld+json")
    expect(JSON.parse(script.children)).toEqual(websiteJsonLd())
  })
})
