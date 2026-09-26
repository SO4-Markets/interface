import { describe, expect, test } from "bun:test"
import { generateSeoTags } from "../src/lib/seo"
import { generateOgSvg } from "../../../scripts/lib/og-generator.ts"

describe("SEO metadata and social preview generator (DX-047)", () => {
  test("generates unique title suffix, description, OG/Twitter tags, and TechArticle schema", () => {
    const seo = generateSeoTags({
      title: "Placing your first trade",
      description: "Connect a wallet, pick a market, and submit a market order in a few steps.",
      route: "/get-started/quickstart",
      updated: "2026-08-24",
      section: "Get Started",
    })

    expect(seo.headTags).toContain("<title>Placing your first trade · SO4 docs</title>")
    expect(seo.headTags).toContain('<meta name="description" content="Connect a wallet, pick a market, and submit a market order in a few steps.">')
    expect(seo.headTags).toContain('<meta property="og:title" content="Placing your first trade · SO4 docs">')
    expect(seo.headTags).toContain('<meta property="og:image" content="https://docs.so4.market/og/get-started/quickstart.svg">')
    expect(seo.headTags).toContain('<meta name="twitter:card" content="summary_large_image">')

    expect(seo.structuredDataHtml).toContain('"@type": "TechArticle"')
    expect(seo.structuredDataHtml).toContain('"headline": "Placing your first trade"')
    expect(seo.structuredDataHtml).toContain('"dateModified": "2026-08-24"')
    expect(seo.structuredDataHtml).toContain('"name": "SO4 Market"')
  })

  test("generates valid OpenGraph SVG payload", () => {
    const svg = generateOgSvg({
      title: "Risk Disclosure",
      section: "Concepts",
      description: "An honest enumeration of risks associated with leverage and margin trading.",
    })

    expect(svg).toContain('<svg width="1200" height="630"')
    expect(svg).toContain("CONCEPTS")
    expect(svg).toContain("Risk Disclosure")
    expect(svg).toContain("SO4")
  })
})
