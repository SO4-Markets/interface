import { readdir } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

export const appRoot = resolve(import.meta.dir, "..")
export const contentRoot = join(appRoot, "content")
/** Root of frozen version snapshots (DX-050) — see scripts/snapshot-version.ts. */
export const versionsRoot = join(appRoot, "content-versions")

export type Frontmatter = {
  title: string
  description: string
  updated: string
  status: "stable" | "beta" | "draft"
  sidebarLabel?: string
  order?: number
  tags?: Array<string>
  landing?: Array<string>
}

export type Page = {
  file: string
  route: string
  frontmatter: Frontmatter
  body: string
}

async function walk(directory: string): Promise<Array<string>> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

function parseValue(value: string): string | Array<string> {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value
}

export function parsePage(file: string, source: string, root: string = contentRoot): Page {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${file}: missing frontmatter`)

  const values: Record<string, string | Array<string>> = {}
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":")
    if (separator < 1)
      throw new Error(`${file}: invalid frontmatter line: ${line}`)
    values[line.slice(0, separator)] = parseValue(
      line.slice(separator + 1).trim(),
    )
  }

  return {
    file,
    route: `/${relative(root, file)
      .replace(/\.mdx$/, "")
      .replaceAll("\\", "/")}`,
    frontmatter: values as unknown as Frontmatter,
    body: match[2].trim(),
  }
}

/** Loads every .mdx page under an arbitrary content root, computing routes
 * relative to that root. Used both for the live `content/` tree and for
 * frozen version snapshots under `content-versions/<id>/` (DX-050), which
 * mirror the same directory shape. */
export async function loadPagesFrom(root: string): Promise<Array<Page>> {
  const files = (await walk(root)).filter((file) => file.endsWith(".mdx"))
  return Promise.all(
    files.map(async (file) =>
      parsePage(file, await Bun.file(file).text(), root),
    ),
  )
}

export async function loadPages(): Promise<Array<Page>> {
  return loadPagesFrom(contentRoot)
}

export function headingEntries(body: string) {
  const lines = body.split("\n")
  const entries: Array<{
    title: string
    id: string
    answer?: string
  }> = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{2,6}) (.+?)(?: \{#([a-z0-9-]+)\})?$/)
    if (!match) continue
    const title = match[2]
    const id = match[3] ?? slugifyHeading(title)
    let answer = ""
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]
      if (/^(#{2,6}) /.test(next)) break
      if (next.trim()) answer = (answer ? `${answer} ` : "") + next.trim()
    }
    entries.push({ title, id, answer: answer || undefined })
  }
  return entries
}

export function slugifyHeading(title: string): string {
  return title
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function internalLinks(body: string) {
  const markdown = [...body.matchAll(/\]\((\/[a-z0-9/#-]+)\)/gi)].map(
    (match) => match[1],
  )
  const terms = [...body.matchAll(/<Term id="([a-z0-9-]+)">/g)].map(
    (match) => `/reference/glossary#${match[1]}`,
  )
  return [...markdown, ...terms]
}
