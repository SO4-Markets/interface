import { describe, expect, test } from "bun:test"
import { generateSitemapXml, generateRobotsTxt, buildSitemapAndRobots } from "./sitemap.ts"

describe("DX-046: sitemap.xml and robots.txt generation", () => {
  test("generateSitemapXml builds standard schema compliant xml", () => {
    const entries = [
      { url: "https://docs.so4.market/", lastmod: "2026-08-30" },
      { url: "https://docs.so4.market/get-started/quickstart", lastmod: "2026-08-28" },
    ]

    const xml = generateSitemapXml(entries)
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain("<loc>https://docs.so4.market/</loc>")
    expect(xml).toContain("<lastmod>2026-08-30</lastmod>")
    expect(xml).toContain("<loc>https://docs.so4.market/get-started/quickstart</loc>")
    expect(xml).toContain("<lastmod>2026-08-28</lastmod>")
  })

  test("generateRobotsTxt allows root and references sitemap URL", () => {
    const robots = generateRobotsTxt("https://docs.so4.market")
    expect(robots).toContain("User-agent: *")
    expect(robots).toContain("Allow: /")
    expect(robots).toContain("Sitemap: https://docs.so4.market/sitemap.xml")
  })

  test("buildSitemapAndRobots excludes draft pages and populates validated lastmod", async () => {
    const { sitemapXml, entryCount } = await buildSitemapAndRobots("https://docs.so4.market")
    expect(entryCount).toBeGreaterThan(0)
    // Draft page should be excluded
    expect(sitemapXml).not.toContain("/resources/terms")
    expect(sitemapXml).toContain("/get-started/introduction")
    expect(sitemapXml).toContain("<lastmod>")
  })
})
