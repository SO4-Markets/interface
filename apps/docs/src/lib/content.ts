import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { validateFrontmatter } from "./frontmatter"
import type { Frontmatter } from "./frontmatter"

export const appRoot = import.meta.dir + "/../.."
export const contentRoot = join(appRoot, "content")

export interface Page {
  file: string
  route: string
  frontmatter: Frontmatter
  body: string
}

export interface PageIndex {
  byRoute: Map<string, Page>
  byFile: Map<string, Page>
  pages: Page[]
}

export function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  )
  return files.flat()
}

interface MetaSection {
  label: string
  icon?: string
  pages: string[]
}

interface MetaConfig {
  sections: MetaSection[]
}

function parseMetaSections(meta: MetaConfig): MetaSection[] {
  return meta.sections
}

export async function loadContentIndex(
  mode: "development" | "production" = "production"
): Promise<PageIndex> {
  const metaRaw = await readFile(join(contentRoot, "meta.json"), "utf8")
  const meta = JSON.parse(metaRaw) as MetaConfig
  const sections = parseMetaSections(meta)

  const mdxFiles = (await walk(contentRoot)).filter((f) => f.endsWith(".mdx"))
  const byRoute = new Map<string, Page>()
  const byFile = new Map<string, Page>()
  const pages: Page[] = []
  const errors: string[] = []

  for (const file of mdxFiles) {
    const name = file
      .split("/")
      .pop()!
      .replace(/\.mdx$/, "")
    const sourceName = name.replace(/\.generated$/, "")
    if (!isKebabCase(sourceName)) {
      errors.push(`${file}: filename "${name}" is not lowercase kebab-case`)
      continue
    }

    const rel = relative(contentRoot, file).replace(/\.mdx$/, "")
    const route = `/${rel.replaceAll("\\", "/")}`

    if (byRoute.has(route)) {
      const existing = byRoute.get(route)!
      errors.push(`duplicate route ${route}: ${existing.file} and ${file}`)
      continue
    }

    const source = await Bun.file(file).text()
    const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
      errors.push(`${file}: missing frontmatter`)
      continue
    }

    const raw: Record<string, unknown> = {}
    for (const line of match[1].split("\n")) {
      const sep = line.indexOf(":")
      if (sep < 1) continue
      const key = line.slice(0, sep).trim()
      const rawVal = line.slice(sep + 1).trim() as string
      let val: string | string[] = rawVal
      if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        val = rawVal
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      }
      raw[key] = val
    }

    const frontmatter = validateFrontmatter(file, raw)

    if (mode === "production" && frontmatter.status === "draft") continue

    const page: Page = { file, route, frontmatter, body: match[2].trim() }
    byRoute.set(route, page)
    byFile.set(file, page)
    pages.push(page)
  }

  const sidebarRoutes = new Set(
    sections.flatMap((s) => s.pages.map((p) => `/${p}`))
  )

  for (const route of sidebarRoutes) {
    if (!byRoute.has(route)) {
      errors.push(`sidebar references missing ${route}`)
    }
  }
  for (const route of byRoute.keys()) {
    if (route !== "/index" && !sidebarRoutes.has(route)) {
      errors.push(`orphan page ${route}`)
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"))
  }

  return { byRoute, byFile, pages }
}
