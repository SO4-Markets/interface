import * as fs from "node:fs"
import * as path from "node:path"
import { parseMermaid } from "./mermaid"

export interface ContentCheckOptions {
  root: string
  fix?: boolean
  today?: string
}

export interface ContentDiagnostic {
  file: string
  line: number
  rule: string
  message: string
}

interface PageRecord {
  absPath: string
  relPath: string
  section: string
  slug: string
  frontmatter: Record<string, string>
  frontmatterStart: number
  body: string
}

const REQUIRED_FIELDS = ["title", "description", "updated"] as const
const VALID_STATUS = new Set(["stable", "beta", "draft"])
const FRESH_DAYS = 180

export function checkContent(
  options: ContentCheckOptions
): Array<ContentDiagnostic> {
  const root = path.resolve(options.root)
  const diagnostics: Array<ContentDiagnostic> = []
  const pages = collectPages(root)

  for (const page of pages) {
    diagnostics.push(...checkFrontmatter(page, root))
    diagnostics.push(...checkFilename(page))
    diagnostics.push(...checkSlug(page))
    diagnostics.push(...checkFreshness(page, options.today ?? todayIso()))
    diagnostics.push(...checkMermaid(page))
  }

  diagnostics.push(...checkDuplicateTitles(pages))
  diagnostics.push(...checkNavManifests(root, pages, Boolean(options.fix)))
  diagnostics.push(...checkOrphanedAssets(root, pages))

  if (options.fix) {
    fixUpdatedDates(pages, options.today ?? todayIso())
  }

  return diagnostics
}

export function formatDiagnostics(
  diagnostics: Array<ContentDiagnostic>
): string {
  if (diagnostics.length === 0) return "check:content passed - 0 errors."

  const byFile = new Map<string, Array<ContentDiagnostic>>()
  for (const diagnostic of diagnostics) {
    const current = byFile.get(diagnostic.file) ?? []
    current.push(diagnostic)
    byFile.set(diagnostic.file, current)
  }

  const lines: Array<string> = []
  for (const [file, fileDiagnostics] of byFile) {
    lines.push(file)
    for (const diagnostic of fileDiagnostics) {
      lines.push(
        `  ${diagnostic.line}: ${diagnostic.rule} - ${diagnostic.message}`
      )
    }
  }
  lines.push(
    `Summary: ${diagnostics.length} error${diagnostics.length === 1 ? "" : "s"}.`
  )
  return lines.join("\n")
}

function collectPages(root: string): Array<PageRecord> {
  const contentRoot = path.join(root, "content")
  if (!fs.existsSync(contentRoot)) return []
  const pages: Array<PageRecord> = []

  walk(contentRoot, (absPath) => {
    if (path.extname(absPath) !== ".mdx") return
    const relPath = slash(path.relative(root, absPath))
    const section =
      slash(path.relative(contentRoot, path.dirname(absPath))) || "."
    const source = fs.readFileSync(absPath, "utf8")
    const parsed = parseFrontmatter(source)
    const fileSlug = path.basename(absPath, ".mdx")
    pages.push({
      absPath,
      relPath,
      section,
      slug:
        fileSlug === "index"
          ? "/"
          : `/${section === "." ? fileSlug : `${section}/${fileSlug}`}`,
      frontmatter: parsed.frontmatter,
      frontmatterStart: parsed.frontmatterStart,
      body: parsed.body,
    })
  })

  return pages
}

function parseFrontmatter(source: string): {
  frontmatter: Record<string, string>
  frontmatterStart: number
  body: string
} {
  const lines = source.split("\n")
  if (lines[0] !== "---")
    return { frontmatter: {}, frontmatterStart: 1, body: source }
  const end = lines.findIndex((line, index) => index > 0 && line === "---")
  if (end === -1) return { frontmatter: {}, frontmatterStart: 1, body: source }

  const frontmatter: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (!match) continue
    frontmatter[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }

  return {
    frontmatter,
    frontmatterStart: 2,
    body: lines.slice(end + 1).join("\n"),
  }
}

function checkFrontmatter(
  page: PageRecord,
  root: string
): Array<ContentDiagnostic> {
  const diagnostics: Array<ContentDiagnostic> = []
  if (Object.keys(page.frontmatter).length === 0) {
    diagnostics.push(
      error(root, page, "frontmatter", "missing frontmatter block")
    )
    return diagnostics
  }

  for (const field of REQUIRED_FIELDS) {
    if (!page.frontmatter[field]) {
      diagnostics.push(
        error(root, page, "frontmatter", `missing required field "${field}"`)
      )
    }
  }

  const title = page.frontmatter.title
  if (title && title.length > 60) {
    diagnostics.push(
      error(root, page, "frontmatter", "title must be 60 characters or fewer")
    )
  }

  const description = page.frontmatter.description
  if (description && (description.length < 50 || description.length > 160)) {
    diagnostics.push(
      error(root, page, "frontmatter", "description must be 50-160 characters")
    )
  }

  const status = page.frontmatter.status
  if (status && !VALID_STATUS.has(status)) {
    diagnostics.push(
      error(root, page, "frontmatter", "status must be stable, beta, or draft")
    )
  }

  return diagnostics
}

function checkFilename(page: PageRecord): Array<ContentDiagnostic> {
  const fileName = path.basename(page.absPath)
  if (/^(index|[a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/.test(fileName)) return []
  return [
    {
      file: page.relPath,
      line: 1,
      rule: "filename",
      message: "filename must use lowercase kebab-case or index.mdx",
    },
  ]
}

function checkSlug(page: PageRecord): Array<ContentDiagnostic> {
  const declared = page.frontmatter.slug
  if (!declared || declared === page.slug) return []
  return [
    {
      file: page.relPath,
      line: page.frontmatterStart,
      rule: "slug",
      message: `slug must remain stable at "${page.slug}"`,
    },
  ]
}

function checkFreshness(
  page: PageRecord,
  today: string
): Array<ContentDiagnostic> {
  const updated = page.frontmatter.updated
  if (!updated) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
    return [error("", page, "updated", "updated must be an ISO date")]
  }

  const ageDays = daysBetween(updated, today)
  if (ageDays < 0)
    return [error("", page, "updated", "updated must not be in the future")]
  if (ageDays > FRESH_DAYS) {
    return [
      error(
        "",
        page,
        "updated",
        `updated is stale by ${ageDays - FRESH_DAYS} days`
      ),
    ]
  }
  return []
}

function checkDuplicateTitles(
  pages: Array<PageRecord>
): Array<ContentDiagnostic> {
  const diagnostics: Array<ContentDiagnostic> = []
  const bySection = new Map<string, Map<string, PageRecord>>()

  for (const page of pages) {
    const title = page.frontmatter.title
    if (!title) continue
    const sectionTitles =
      bySection.get(page.section) ?? new Map<string, PageRecord>()
    const previous = sectionTitles.get(title.toLowerCase())
    if (previous) {
      diagnostics.push({
        file: page.relPath,
        line: page.frontmatterStart,
        rule: "duplicate-title",
        message: `title duplicates ${previous.relPath} within section "${page.section}"`,
      })
    }
    sectionTitles.set(title.toLowerCase(), page)
    bySection.set(page.section, sectionTitles)
  }

  return diagnostics
}

function checkNavManifests(
  root: string,
  pages: Array<PageRecord>,
  fix: boolean
): Array<ContentDiagnostic> {
  const contentRoot = path.join(root, "content")
  const diagnostics: Array<ContentDiagnostic> = []
  const pagesBySection = groupBy(pages, (page) => page.section)

  for (const [section, sectionPages] of pagesBySection) {
    if (section === ".") continue
    const manifestPath = path.join(contentRoot, section, "meta.json")
    const listed = readManifest(manifestPath)
    const actual = sectionPages
      .map((page) => path.basename(page.absPath, ".mdx"))
      .sort()
    const listedSorted = [...listed].sort()

    if (!fs.existsSync(manifestPath)) {
      diagnostics.push({
        file: slash(path.relative(root, manifestPath)),
        line: 1,
        rule: "nav",
        message: "missing nav manifest",
      })
      continue
    }

    for (const slug of actual) {
      if (!listed.includes(slug)) {
        diagnostics.push({
          file: slash(path.relative(root, manifestPath)),
          line: 1,
          rule: "nav",
          message: `manifest is missing page "${slug}"`,
        })
      }
    }
    for (const slug of listed) {
      if (!actual.includes(slug)) {
        diagnostics.push({
          file: slash(path.relative(root, manifestPath)),
          line: 1,
          rule: "nav",
          message: `manifest lists missing page "${slug}"`,
        })
      }
    }
    if (listed.join("\n") !== listedSorted.join("\n")) {
      diagnostics.push({
        file: slash(path.relative(root, manifestPath)),
        line: 1,
        rule: "nav",
        message: "manifest pages must be sorted",
      })
      if (fix) writeManifest(manifestPath, listedSorted)
    }
  }

  return diagnostics
}

function checkOrphanedAssets(
  root: string,
  pages: Array<PageRecord>
): Array<ContentDiagnostic> {
  const assetsRoot = path.join(root, "public", "assets")
  if (!fs.existsSync(assetsRoot)) return []
  const body = pages.map((page) => page.body).join("\n")
  const diagnostics: Array<ContentDiagnostic> = []

  walk(assetsRoot, (absPath) => {
    const relFromPublic = slash(
      path.relative(path.join(root, "public"), absPath)
    )
    if (
      !body.includes(`/assets/${path.basename(absPath)}`) &&
      !body.includes(`/${relFromPublic}`)
    ) {
      diagnostics.push({
        file: slash(path.relative(root, absPath)),
        line: 1,
        rule: "orphaned-asset",
        message: "asset is not referenced by any content page",
      })
    }
  })

  return diagnostics
}

function fixUpdatedDates(pages: Array<PageRecord>, today: string): void {
  for (const page of pages) {
    const diagnostics = checkFreshness(page, today)
    if (!diagnostics.length) continue
    const source = fs.readFileSync(page.absPath, "utf8")
    const next = source.replace(/^updated:\s*.*$/m, `updated: ${today}`)
    fs.writeFileSync(page.absPath, next)
  }
}

function readManifest(absPath: string): Array<string> {
  if (!fs.existsSync(absPath)) return []
  const parsed = JSON.parse(fs.readFileSync(absPath, "utf8")) as {
    pages?: Array<string>
  }
  return Array.isArray(parsed.pages) ? parsed.pages : []
}

function writeManifest(absPath: string, pages: Array<string>): void {
  const parsed = JSON.parse(fs.readFileSync(absPath, "utf8")) as Record<
    string,
    unknown
  >
  parsed.pages = pages
  fs.writeFileSync(absPath, `${JSON.stringify(parsed, null, 2)}\n`)
}

function groupBy<T>(
  items: Array<T>,
  key: (item: T) => string
): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>()
  for (const item of items) {
    const value = key(item)
    const current = groups.get(value) ?? []
    current.push(item)
    groups.set(value, current)
  }
  return groups
}

function walk(dir: string, visit: (absPath: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(absPath, visit)
    if (entry.isFile()) visit(absPath)
  }
}

function error(
  root: string,
  page: PageRecord,
  rule: string,
  message: string
): ContentDiagnostic {
  return {
    file: root ? slash(path.relative(root, page.absPath)) : page.relPath,
    line: page.frontmatterStart,
    rule,
    message,
  }
}

function daysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00Z`)
  const toTime = Date.parse(`${to}T00:00:00Z`)
  return Math.floor((toTime - fromTime) / 86_400_000)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function checkMermaid(page: PageRecord): Array<ContentDiagnostic> {
  const diagnostics: Array<ContentDiagnostic> = []
  const lines = page.body.split("\n")
  let inMermaid = false
  let mermaidStartLine = 0
  let metaStr = ""
  let mermaidCodeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("```mermaid")) {
      inMermaid = true
      mermaidStartLine = i + 1
      metaStr = line.slice("```mermaid".length)
      mermaidCodeLines = []
    } else if (inMermaid && line.startsWith("```")) {
      inMermaid = false
      const code = mermaidCodeLines.join("\n").trim()
      const captionMatch = metaStr.match(/caption=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
      const titleMatch = metaStr.match(/title=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
      const caption = captionMatch?.[1] || captionMatch?.[2] || captionMatch?.[3]
      const title = titleMatch?.[1] || titleMatch?.[2] || titleMatch?.[3]

      try {
        const ast = parseMermaid(code, {
          caption,
          title,
          file: page.relPath,
          line: mermaidStartLine,
        })
        if (!caption && !ast.accDescr && !ast.accTitle && !title) {
          diagnostics.push({
            file: page.relPath,
            line: mermaidStartLine,
            rule: "mermaid-caption",
            message: 'mermaid diagram missing required caption="..."',
          })
        }
      } catch (err: any) {
        diagnostics.push({
          file: page.relPath,
          line: mermaidStartLine,
          rule: "mermaid-syntax",
          message: err.message || String(err),
        })
      }
    } else if (inMermaid) {
      mermaidCodeLines.push(line)
    }
  }

  return diagnostics
}

function slash(value: string): string {
  return value.split(path.sep).join("/")
}
