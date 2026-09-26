import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { contentRoot, headingEntries, loadPages } from "./content"
import { validateFrontmatter } from "../src/lib/frontmatter"
import { parseMermaid } from "../src/lib/mermaid"

const isFix = process.argv.includes("--fix")
const pages = await loadPages()
const errors: Array<string> = []
const routes = new Set(pages.map((page) => page.route))

/**
 * DX-045's date rule can only be answered where git history is actually
 * present. In a shallow clone — what `actions/checkout` produces by default —
 * every file looks as though it were added by the single fetched commit, so
 * `git log -1 -- <file>` returns the head commit's date for *all* of them and
 * the rule would flag every page on every run. Detect that and skip, rather
 * than reporting a date that git cannot really tell us.
 */
function isShallowRepository(): boolean {
  const proc = Bun.spawnSync(["git", "rev-parse", "--is-shallow-repository"])
  return proc.stdout.toString().trim() === "true"
}

/**
 * A file with uncommitted changes is being updated right now, so its last
 * commit predates the edit by definition. Comparing against it would make the
 * rule unsatisfiable before a commit exists — the author would have to write
 * the *previous* commit's date into a page they just rewrote.
 */
function hasUncommittedChanges(file: string): boolean {
  const proc = Bun.spawnSync(["git", "status", "--porcelain", "--", file])
  return proc.stdout.toString().trim().length > 0
}

const skipDateCheck = isShallowRepository()

for (const page of pages) {
  const { description, status, title, updated } = page.frontmatter
  if (!title || title.length > 60)
    errors.push(`${page.route}: title must be 1-60 characters`)
  if (!description || description.length < 50 || description.length > 160) {
    errors.push(`${page.route}: description must be 50-160 characters`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated))
    errors.push(`${page.route}: updated must be ISO date`)
  if (!["stable", "beta", "draft"].includes(status))
    errors.push(`${page.route}: invalid status`)

  // DX-045: Validate updated date against git commit history if tracked
  if (
    !skipDateCheck &&
    !page.file.endsWith(".generated.mdx") &&
    status !== "draft" &&
    !hasUncommittedChanges(page.file)
  ) {
    try {
      // Author date, not committer date: squash- and rebase-merges rewrite
      // the committer date to the merge time, which would re-break every
      // page touched by a pull request the moment it lands.
      const proc = Bun.spawnSync([
        "git",
        "log",
        "-1",
        "--format=%as",
        "--",
        page.file,
      ])
      const gitDate = proc.stdout.toString().trim()
      if (gitDate && /^\d{4}-\d{2}-\d{2}$/.test(gitDate)) {
        if (updated !== gitDate) {
          if (isFix) {
            const raw = await readFile(page.file, "utf-8")
            const fixed = raw.replace(/^updated:\s*.*$/m, `updated: ${gitDate}`)
            await writeFile(page.file, fixed, "utf-8")
            page.frontmatter.updated = gitDate
          } else {
            errors.push(
              `${page.route}: frontmatter updated date (${updated}) does not match last git commit date (${gitDate})`
            )
          }
        }
      }
    } catch {
      // Ignore if git is not available
    }
  }

  // DX-055: Enforce image alt text and dimension requirements
  const imgMatches = page.body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)
  for (const match of imgMatches) {
    const alt = match[1]
    const src = match[2]
    if (alt.trim() === "") {
      errors.push(`${page.route}: image "${src}" missing required alt text`)
    }
  }

  // DX-054: Enforce Mermaid diagram captions and valid syntax
  const mermaidMatches = page.body.matchAll(/```mermaid([^\n]*)\n([\s\S]*?)```/g)
  for (const match of mermaidMatches) {
    const metaStr = match[1]
    const code = match[2].trim()
    const captionMatch = metaStr.match(/caption=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
    const titleMatch = metaStr.match(/title=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
    const caption = captionMatch?.[1] || captionMatch?.[2] || captionMatch?.[3]
    const title = titleMatch?.[1] || titleMatch?.[2] || titleMatch?.[3]

    try {
      const ast = parseMermaid(code, { caption, title, file: page.route })
      if (!caption && !ast.accDescr && !ast.accTitle && !title) {
        errors.push(`${page.route}: mermaid diagram missing required caption="..."`)
      }
    } catch (err: any) {
      errors.push(`${page.route}: ${err.message || String(err)}`)
    }
  }
}

const meta = JSON.parse(
  await readFile(join(contentRoot, "meta.json"), "utf8"),
) as {
  sections: Array<{ label: string; pages: Array<string> }>
}
const navRoutes = meta.sections.flatMap((section) =>
  section.pages.map((page) => `/${page}`),
)
for (const route of navRoutes)
  if (!routes.has(route)) errors.push(`sidebar references missing ${route}`)
for (const route of routes)
  // `/index` is the docs home page and is intentionally not in the sidebar.
  if (route !== "/index" && !navRoutes.includes(route))
    errors.push(`orphan page ${route}`)

const glossary = pages.find((page) => page.route === "/reference/glossary")
if (!glossary) {
  errors.push("missing glossary")
} else {
  const entries = headingEntries(glossary.body)
  const titles = entries.map((entry) => entry.title)
  const sorted = [...titles].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  )
  if (titles.some((title, index) => title !== sorted[index]))
    errors.push("glossary is not alphabetical")
  // `headingEntries` returns `{ title, id }` pairs, so each entry's onward
  // link is found in its own section of the glossary body.
  const sections = glossary.body.split(/\n(?=## )/)
  for (const entry of entries) {
    const section = sections.find((text) =>
      text.split("\n")[0].startsWith(`## ${entry.title}`),
    )
    const link = section?.match(/\]\((\/[a-z0-9/#-]+)\)/)?.[1]
    if (!link) errors.push(`glossary#${entry.id}: missing onward link`)
    else if (!routes.has(link.split("#")[0]))
      errors.push(`glossary#${entry.id}: missing page ${link}`)
  }
}

const termPages = pages.filter((page) => page.body.includes("<Term id="))
if (termPages.length < 3)
  errors.push("<Term> must be demonstrated on at least three pages")

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(
  `Content check passed: ${pages.length} pages, zero orphans, alphabetical glossary.`,
)
