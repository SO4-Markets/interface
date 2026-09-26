import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

import { appRoot, contentRoot, headingEntries, loadPages } from "./content"
import { readdir } from "node:fs/promises"

// bun run scripts/check-links.ts          -> internal only (fails CI on broken internal links/anchors/assets)
// bun run scripts/check-links.ts --external -> external only (scheduled workflow, never blocks PR)

const isExternal = process.argv.includes("--external")
const ignoreListPath = join(appRoot, "link-ignore.json")

type Failure = { line: number; raw: string; message: string }
type Grouped = Map<string, Array<Failure>>

async function loadIgnoreList(): Promise<Array<string>> {
  if (!existsSync(ignoreListPath)) return []
  try {
    const raw = await readFile(ignoreListPath, "utf8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string")
    return []
  } catch {
    return []
  }
}

function isIgnored(url: string, patterns: Array<string>): boolean {
  for (const pat of patterns) {
    // simple glob: support * wildcard, otherwise substring match
    if (pat.includes("*")) {
      const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
      if (new RegExp(`^${escaped}$`).test(url)) return true
    } else if (url.includes(pat)) {
      return true
    }
  }
  return false
}

function extractLinksPerLine(raw: string): Array<{ line: number; url: string; isImage: boolean; raw: string }> {
  const lines = raw.split(/\r?\n/)
  const out: Array<{ line: number; url: string; isImage: boolean; raw: string }> = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    // markdown links and images: [text](url) and ![alt](url)
    // capture url without title: url may be followed by space + "title"
    const mdRe = /(!)?\[([^\]]*)\]\(([^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = mdRe.exec(line))) {
      const isImage = m[1] === "!"
      let url = m[3].trim()
      // strip optional title after space: [text](url "title")
      const spaceIdx = url.search(/\s+"/)
      if (spaceIdx !== -1) url = url.slice(0, spaceIdx).trim()
      // strip surrounding < > if present: <https://...>
      if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1)
      // strip quotes
      url = url.replace(/^["']|["']$/g, "")
      if (!url) continue
      out.push({ line: lineNo, url, isImage, raw: m[0] })
    }

    // html <img src="..."> and <a href="...">
    const htmlRe = /<(?:img|a)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/gi
    while ((m = htmlRe.exec(line))) {
      const url = m[1].trim()
      const isImage = m[0].toLowerCase().startsWith("<img")
      if (!url) continue
      // avoid double-counting if already captured as markdown on same line with same url,
      // but keep it simple: push if not already present at this line+url
      if (!out.some((e) => e.line === lineNo && e.url === url)) {
        out.push({ line: lineNo, url, isImage, raw: m[0] })
      }
    }

    // <Term id="...">
    const termRe = /<Term\s+id="([a-z0-9-]+)"/g
    while ((m = termRe.exec(line))) {
      const id = m[1]
      const url = `/reference/glossary#${id}`
      out.push({ line: lineNo, url, isImage: false, raw: m[0] })
    }
  }
  return out
}

async function loadPagesRobust(): Promise<Awaited<ReturnType<typeof loadPages>>> {
  // Fallback loader that handles \r\n line endings (Windows) robustly.
  // On Linux CI the standard loadPages already works, but this ensures parity.
  try {
    return await loadPages()
  } catch {
    // manual walk + parse that tolerates \r
    async function walk(dir: string): Promise<Array<string>> {
      const entries = await readdir(dir, { withFileTypes: true })
      const files = await Promise.all(
        entries.map((e) => {
          const p = join(dir, e.name)
          return e.isDirectory() ? walk(p) : Promise.resolve([p])
        }),
      )
      return files.flat()
    }
    const files = (await walk(contentRoot)).filter((f) => f.endsWith(".mdx"))
    const pages: Array<{ file: string; route: string; frontmatter: any; body: string }> = []
    for (const file of files) {
      const raw = await Bun.file(file).text()
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      if (!m) throw new Error(`${file}: missing frontmatter`)
      const body = m[2].trim()
      const route = `/${relative(contentRoot, file).replace(/\.mdx$/, "").replaceAll("\\", "/")}`
      // minimal frontmatter parse for completeness
      pages.push({ file, route, frontmatter: {} as any, body })
    }
    return pages as any
  }
}
const pages = await loadPagesRobust()
const routeMap = new Map(pages.map((p) => [p.route, p]))

// Robust heading id extraction that handles \r\n and trims, unlike the imported
// headingEntries which splits on "\n" only. Use local slugify to ensure CI vs Windows parity.
function localSlugify(title: string): string {
  return title
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}
function localHeadingIds(body: string): Set<string> {
  const ids = new Set<string>()
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const m = line.match(/^(#{2,6}) (.+?)(?: \{#([a-z0-9-]+)\})?$/)
    if (!m) continue
    const title = m[2].trim()
    const id = m[3] ?? localSlugify(title)
    ids.add(id)
  }
  return ids
}
const headingIdsByRoute = new Map<string, Set<string>>()
for (const page of pages) {
  // Prefer local robust extraction; fallback to imported for parity but ensure \r handling
  const ids = localHeadingIds(page.body)
  // Also merge ids from imported headingEntries for explicit {#id} that may have been trimmed differently
  for (const e of headingEntries(page.body)) ids.add(e.id)
  headingIdsByRoute.set(page.route, ids)
}
const ignorePatterns = await loadIgnoreList()

const grouped: Grouped = new Map()
let totalFailures = 0

function addFailure(file: string, failure: Failure) {
  if (!grouped.has(file)) grouped.set(file, [])
  grouped.get(file)!.push(failure)
  totalFailures++
}

if (!isExternal) {
  // Internal validation: routes, anchors, and image/asset paths
  for (const page of pages) {
    const raw = await Bun.file(page.file).text()
    const relFile = relative(resolve(appRoot, "../.."), page.file).replaceAll("\\", "/")
    const links = extractLinksPerLine(raw)

    for (const { line, url, isImage } of links) {
      // skip external urls in internal mode (checked separately)
      if (/^https?:\/\//i.test(url)) continue
      if (url.startsWith("mailto:") || url.startsWith("tel:")) continue
      if (isIgnored(url, ignorePatterns)) continue
      // skip pure hash? but we validate same-page anchors
      if (url.startsWith("#")) {
        const anchor = url.slice(1)
        if (!anchor) continue
        const ids = headingIdsByRoute.get(page.route)
        if (!ids?.has(anchor)) {
          addFailure(relFile, { line, raw: url, message: `broken anchor "${url}" — heading "#${anchor}" not found on ${page.route}` })
        }
        continue
      }

      // internal absolute route: /...
      if (url.startsWith("/")) {
        const [routePart, anchor] = url.split("#")
        const cleanRoute = routePart.split("?")[0].replace(/\/$/, "") || "/"
        // route validation
        // For markdown images, the src may be an asset path like /assets/... or /images/...
        // Those are not docs routes; validate as public asset instead
        const isAssetPath = isImage || cleanRoute.startsWith("/assets/") || cleanRoute.startsWith("/public/")

        if (isAssetPath) {
          // check filesystem under apps/docs/public
          const assetPath = cleanRoute.replace(/^\/public\//, "/")
          const fsPath = join(appRoot, "public", assetPath)
          // allow route-like asset that is also a docs page? check routeMap first
          if (routeMap.has(cleanRoute)) {
            // it's a valid page, check anchor if present
            if (anchor) {
              const ids = headingIdsByRoute.get(cleanRoute)
              if (!ids?.has(anchor)) {
                addFailure(relFile, { line, raw: url, message: `broken anchor "${url}" — heading "#${anchor}" not found on ${cleanRoute}` })
              }
            }
          } else if (!existsSync(fsPath)) {
            addFailure(relFile, { line, raw: url, message: `broken asset path "${url}" — file not found at public${assetPath}` })
          } else if (anchor) {
            // asset with anchor is unusual, but validate if target is html? skip
          }
          continue
        }

        const target = routeMap.get(cleanRoute)
        if (!target) {
          addFailure(relFile, { line, raw: url, message: `broken link "${url}" — route "${cleanRoute}" not found` })
          continue
        }
        if (anchor) {
          const ids = headingIdsByRoute.get(cleanRoute)
          if (!ids?.has(anchor)) {
            addFailure(relFile, { line, raw: url, message: `broken anchor "${url}" — heading "#${anchor}" not found on ${cleanRoute}` })
          }
        }
        continue
      }

      // relative paths: ./ or ../  -> treat as asset/image relative to page file
      if (url.startsWith("./") || url.startsWith("../")) {
        if (!isImage) continue // only validate relative assets/images
        const baseDir = dirname(page.file)
        const fsPath = resolve(baseDir, url.split("#")[0].split("?")[0])
        if (!existsSync(fsPath)) {
          addFailure(relFile, { line, raw: url, message: `broken asset path "${url}" — file not found relative to ${relFile}` })
        }
        continue
      }

      // relative without prefix but looks like asset: e.g., images/foo.png
      // ignore bare relative links that are not images
    }
  }

  if (totalFailures) {
    console.error(formatGrouped(grouped, pages.length))
    process.exit(1)
  }
  console.log(`Link check passed: ${pages.length} pages, zero broken internal links.`)
} else {
  // External validation: fetch each external url, respecting ignore list
  // ignorePatterns already loaded above
  // collect all external urls grouped by source
  const externalByFile: Map<string, Array<{ line: number; url: string; raw: string }>> = new Map()
  const urlToSources: Map<string, Array<{ file: string; line: number; raw: string }>> = new Map()

  for (const page of pages) {
    const raw = await Bun.file(page.file).text()
    const relFile = relative(resolve(appRoot, "../.."), page.file).replaceAll("\\", "/")
    const links = extractLinksPerLine(raw)
    for (const { line, url, raw: rawMatch } of links) {
      if (!/^https?:\/\//i.test(url)) continue
      if (isIgnored(url, ignorePatterns)) continue
      if (!externalByFile.has(relFile)) externalByFile.set(relFile, [])
      externalByFile.get(relFile)!.push({ line, url, raw: rawMatch })
      if (!urlToSources.has(url)) urlToSources.set(url, [])
      urlToSources.get(url)!.push({ file: relFile, line, raw: rawMatch })
    }
  }

  const urls = [...urlToSources.keys()]
  if (urls.length === 0) {
    console.log(`External link check passed: ${pages.length} pages, no external links to check (${ignorePatterns.length} ignored).`)
    process.exit(0)
  }

  console.log(`Checking ${urls.length} external link(s) across ${pages.length} pages...`)

  const failedUrls = new Map<string, string>() // url -> error

  // fetch with concurrency limit
  const CONCURRENCY = 8
  const TIMEOUT_MS = 10000
  let idx = 0
  async function checkOne(url: string) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      // try HEAD first, fall back to GET
      let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal })
      if (!res.ok && res.status >= 400) {
        // some servers block HEAD, try GET
        res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal })
      }
      if (!res.ok) {
        failedUrls.set(url, `HTTP ${res.status} ${res.statusText}`)
      }
    } catch (err: any) {
      failedUrls.set(url, err?.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : (err?.message || String(err)))
    } finally {
      clearTimeout(t)
    }
  }

  const workers: Array<Promise<void>> = []
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(
      (async () => {
        while (idx < urls.length) {
          const cur = idx++
          const url = urls[cur]
          await checkOne(url)
        }
      })(),
    )
  }
  await Promise.all(workers)

  if (failedUrls.size) {
    const groupedExt: Grouped = new Map()
    for (const [url, err] of failedUrls) {
      const sources = urlToSources.get(url) || []
      for (const src of sources) {
        if (!groupedExt.has(src.file)) groupedExt.set(src.file, [])
        groupedExt.get(src.file)!.push({ line: src.line, raw: url, message: `external link failed "${url}" — ${err}` })
      }
    }
    console.error(formatGrouped(groupedExt, pages.length, true))
    process.exit(1)
  }

  console.log(`External link check passed: ${urls.length} external link(s) checked, zero failures.`)
}

function formatGrouped(grouped: Grouped, totalPages: number, isExternal = false): string {
  const kind = isExternal ? "external" : "internal"
  const count = [...grouped.values()].flat().length
  const lines: Array<string> = []
  lines.push(`Found ${count} broken ${kind} link(s) across ${grouped.size} file(s) / ${totalPages} pages:`)
  lines.push("")
  const sortedFiles = [...grouped.keys()].sort()
  for (const file of sortedFiles) {
    const failures = grouped.get(file)!.sort((a, b) => a.line - b.line)
    lines.push(`${file}:`)
    for (const f of failures) {
      lines.push(`  line ${f.line}: ${f.message} (${f.raw})`)
    }
  }
  return lines.join("\n")
}
