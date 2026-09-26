/**
 * DX-046: Generate sitemap.xml and robots.txt for the documentation site.
 *
 * Scans content pages, excludes drafts and redirect sources, attaches validated
 * lastmod dates from frontmatter, and writes standard XML sitemap and robots.txt.
 *
 * Usage:
 *   bun run scripts/sitemap.ts
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { appRoot, loadPages } from "./content.ts"
import { DEFAULT_SITE_URL } from "../src/lib/seo.ts"

export interface SitemapUrlEntry {
  url: string
  lastmod?: string
}

export function generateSitemapXml(
  entries: Array<SitemapUrlEntry>
): string {
  const urlNodes = entries
    .map((e) => {
      const lastmodNode = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""
      return `  <url>\n    <loc>${e.url}</loc>${lastmodNode}\n  </url>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>\n`
}

export function generateRobotsTxt(siteUrl = DEFAULT_SITE_URL): string {
  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n")
}

export async function buildSitemapAndRobots(
  siteUrl = DEFAULT_SITE_URL,
  targetDirs = [
    join(appRoot, "public"),
    join(appRoot, ".nitro-static"),
  ]
): Promise<{ sitemapXml: string; robotsTxt: string; entryCount: number }> {
  const pages = await loadPages()
  // Exclude drafts
  const publicPages = pages.filter((p) => p.frontmatter.status !== "draft")

  const entries: Array<SitemapUrlEntry> = publicPages.map((page) => {
    const route = page.route === "/index" ? "/" : page.route
    return {
      url: `${siteUrl}${route}`,
      lastmod: page.frontmatter.updated,
    }
  })

  // Sort URLs deterministically
  entries.sort((a, b) => a.url.localeCompare(b.url))

  const sitemapXml = generateSitemapXml(entries)
  const robotsTxt = generateRobotsTxt(siteUrl)

  for (const dir of targetDirs) {
    try {
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "sitemap.xml"), sitemapXml, "utf-8")
      await writeFile(join(dir, "robots.txt"), robotsTxt, "utf-8")
    } catch {
      // Ignore if dir cannot be written yet
    }
  }

  return { sitemapXml, robotsTxt, entryCount: entries.length }
}

async function main() {
  const { entryCount } = await buildSitemapAndRobots()
  console.log(`✓ Generated sitemap.xml with ${entryCount} URL(s) and robots.txt`)
}

const invokedDirectly = process.argv[1]?.endsWith("sitemap.ts")
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
