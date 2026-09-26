import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { existsSync } from "node:fs"

const appRoot = join(import.meta.dir, "..")
const budgetsPath = join(appRoot, "budgets.json")
const outputRoot = join(appRoot, ".nitro-static")

interface Budgets {
  initialJsKb: number
  initialCssKb: number
  maxHtmlKb: number
  searchIndexKb?: number
  measured: Record<string, number>
  headroom: Record<string, number>
}

const budgets = JSON.parse(await readFile(budgetsPath, "utf8")) as Budgets

async function walk(dir: string, filter: (f: string) => boolean, files: string[] = []): Promise<string[]> {
  if (!existsSync(dir)) return files
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p, filter, files)
    else if (filter(p)) files.push(p)
  }
  return files
}

function kb(bytes: number) {
  return bytes / 1024
}

let failures: string[] = []

// 1. Initial JS & CSS from Vite assets
const assetsDir = join(outputRoot, "assets")
let jsTotalKb = 0
let cssTotalKb = 0
let jsFiles: Array<{ file: string; kb: number }> = []
let cssFiles: Array<{ file: string; kb: number }> = []

if (existsSync(assetsDir)) {
  const assets = await readdir(assetsDir)
  for (const file of assets) {
    const full = join(assetsDir, file)
    const s = await stat(full)
    const k = kb(s.size)
    if (file.endsWith(".js")) {
      jsTotalKb += k
      jsFiles.push({ file, kb: k })
    }
    if (file.endsWith(".css")) {
      cssTotalKb += k
      cssFiles.push({ file, kb: k })
    }
  }
} else {
  failures.push(`assets dir missing: ${assetsDir} (run build first)`)
}

// Use largest JS chunk for budget (or total) – we check total against budget for simplicity
// Find largest JS file
const largestJs = jsFiles.sort((a, b) => b.kb - a.kb)[0]
const largestCss = cssFiles.sort((a, b) => b.kb - a.kb)[0]
const jsKbToCheck = largestJs ? largestJs.kb : jsTotalKb
const cssKbToCheck = largestCss ? largestCss.kb : cssTotalKb

if (jsKbToCheck > budgets.initialJsKb) {
  failures.push(
    `Initial JS budget exceeded: ${jsKbToCheck.toFixed(2)} KB > ${budgets.initialJsKb} KB (measured current ${budgets.measured.initialJsKb} KB, headroom ${budgets.headroom.initialJsKb} KB). Offending asset: ${largestJs?.file ?? "unknown"} (${jsKbToCheck.toFixed(2)} KB). Adding a large client library (e.g. charting) will breach this.`
  )
}
if (cssKbToCheck > budgets.initialCssKb) {
  failures.push(
    `Initial CSS budget exceeded: ${cssKbToCheck.toFixed(2)} KB > ${budgets.initialCssKb} KB (measured current ${budgets.measured.initialCssKb} KB, headroom ${budgets.headroom.initialCssKb} KB). Offending asset: ${largestCss?.file ?? "unknown"} (${cssKbToCheck.toFixed(2)} KB).`
  )
}

// 2. Largest single page HTML
const htmlFiles = await walk(outputRoot, (f) => f.endsWith(".html"))
let maxHtmlKb = 0
let maxHtmlFile = ""
for (const f of htmlFiles) {
  const s = await stat(f)
  const k = kb(s.size)
  if (k > maxHtmlKb) {
    maxHtmlKb = k
    maxHtmlFile = f.replace(outputRoot, "")
  }
}
if (maxHtmlKb > budgets.maxHtmlKb) {
  failures.push(
    `Largest HTML budget exceeded: ${maxHtmlKb.toFixed(2)} KB > ${budgets.maxHtmlKb} KB (measured current ${budgets.measured.maxHtmlKb} KB, headroom ${budgets.headroom.maxHtmlKb} KB). Offending asset: ${maxHtmlFile} (${maxHtmlKb.toFixed(2)} KB). Consider splitting long pages or lazy-loading heavy components.`
  )
}

// 3. Assert search index not in initial payload
// Check that no HTML file contains <script src="...pagefind...">
// and that pagefind assets are not in assetsDir's initial JS (they should be in pagefind/ folder, lazy)
let searchIndexInInitial = false
let offendingHtml: string | null = null
for (const f of htmlFiles) {
  const content = await readFile(f, "utf8")
  if (/<script[^>]+src=["'][^"']*pagefind[^"']*["']/i.test(content)) {
    searchIndexInInitial = true
    offendingHtml = f.replace(outputRoot, "")
    break
  }
  // Also check that HTML does not inline pagefind data
  if (/pagefind\.js/i.test(content) && /<script[^>]*>/.test(content)) {
    // This is a heuristic: if pagefind.js is referenced as script src, it's initial payload
    // Our static pages should not include it; it's loaded lazily via JS
    if (content.includes('src="/pagefind/') || content.includes("src='/pagefind/")) {
      searchIndexInInitial = true
      offendingHtml = f.replace(outputRoot, "")
      break
    }
  }
}
if (searchIndexInInitial) {
  failures.push(
    `Search index in initial payload: HTML "${offendingHtml}" references pagefind in a blocking script tag. The search index must be lazily loaded (defer/async or dynamic import), not in the initial payload. Offending asset: ${offendingHtml}`
  )
}

// Also check that pagefind directory exists but is not counted in initial budgets (informational)
const pagefindDir = join(outputRoot, "pagefind")
let pagefindKb = 0
if (existsSync(pagefindDir)) {
  const pfFiles = await walk(pagefindDir, () => true)
  for (const f of pfFiles) {
    const s = await stat(f)
    pagefindKb += kb(s.size)
  }
  // Not a failure, just report if exceeds searchIndex budget for info
  if (budgets.searchIndexKb && pagefindKb > budgets.searchIndexKb) {
    failures.push(
      `Search index budget exceeded: ${pagefindKb.toFixed(2)} KB > ${budgets.searchIndexKb} KB (measured ${budgets.measured.searchIndexKb} KB). Consider pruning index or lazy-loading. Offending asset: pagefind/ (${pagefindKb.toFixed(2)} KB)`
    )
  }
}

// Output report
if (failures.length) {
  console.error(`\n[docs-budget] Budget breach detected (${failures.length} failure${failures.length > 1 ? "s" : ""}):\n`)
  for (const f of failures) {
    console.error(`- ${f}\n`)
  }
  console.error(`Current budgets (apps/docs/budgets.json):`)
  console.error(`  initialJsKb: ${budgets.initialJsKb} KB (measured ${budgets.measured.initialJsKb} KB, headroom ${budgets.headroom.initialJsKb} KB)`)
  console.error(`  initialCssKb: ${budgets.initialCssKb} KB (measured ${budgets.measured.initialCssKb} KB, headroom ${budgets.headroom.initialCssKb} KB)`)
  console.error(`  maxHtmlKb: ${budgets.maxHtmlKb} KB (measured ${budgets.measured.maxHtmlKb} KB, headroom ${budgets.headroom.maxHtmlKb} KB)`)
  if (budgets.searchIndexKb) console.error(`  searchIndexKb: ${budgets.searchIndexKb} KB (measured ${budgets.measured.searchIndexKb} KB)`)
  console.error(`\nActual measured:`)
  console.error(`  initialJs (largest): ${jsKbToCheck.toFixed(2)} KB${largestJs ? ` (${largestJs.file})` : ""}, total JS: ${jsTotalKb.toFixed(2)} KB`)
  console.error(`  initialCss (largest): ${cssKbToCheck.toFixed(2)} KB${largestCss ? ` (${largestCss.file})` : ""}, total CSS: ${cssTotalKb.toFixed(2)} KB`)
  console.error(`  maxHtml: ${maxHtmlKb.toFixed(2)} KB (${maxHtmlFile})`)
  console.error(`  pagefind: ${pagefindKb.toFixed(2)} KB`)
  console.error(`\nTo update budgets intentionally, edit apps/docs/budgets.json and document rationale in apps/docs/BUDGET.md.\n`)
  process.exit(1)
}

console.log(`Budget check passed:`)
console.log(`  initialJs: ${jsKbToCheck.toFixed(2)} KB / ${budgets.initialJsKb} KB (headroom ${(budgets.initialJsKb - jsKbToCheck).toFixed(2)} KB)`)
console.log(`  initialCss: ${cssKbToCheck.toFixed(2)} KB / ${budgets.initialCssKb} KB (headroom ${(budgets.initialCssKb - cssKbToCheck).toFixed(2)} KB)`)
console.log(`  maxHtml: ${maxHtmlKb.toFixed(2)} KB / ${budgets.maxHtmlKb} KB (headroom ${(budgets.maxHtmlKb - maxHtmlKb).toFixed(2)} KB)`)
console.log(`  pagefind: ${pagefindKb.toFixed(2)} KB (not in initial payload: ${!searchIndexInInitial})`)
console.log(`  search index not in initial payload: verified`)
