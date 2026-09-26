import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

export interface LintMessage {
  file: string
  line: number
  column: number
  rule: string
  message: string
  severity: "error" | "warning"
}

export interface LintResult {
  file: string
  errors: LintMessage[]
  warnings: LintMessage[]
}

const BANNED_WORDS = [
  { word: "simply", reason: 'Avoid "simply" — if it were simple, the page would not exist.' },
  { word: "just", reason: 'Avoid "just" — describe the step explicitly.' },
  { word: "obviously", reason: 'Avoid "obviously" — state facts without condescension.' },
  { word: "easy", reason: 'Avoid "easy" — state the exact action or complexity.' },
  { word: "easily", reason: 'Avoid "easily" — describe the process directly.' },
]

const REQUIRED_CAPITALIZATIONS = [
  { wrong: /\bsoroban\b/g, correct: "Soroban" },
  { wrong: /\bstellar\b/g, correct: "Stellar" },
  { wrong: /\bfreighter\b/g, correct: "Freighter" },
  { wrong: /\bturborepo\b/g, correct: "Turborepo" },
  { wrong: /\border-vault\b/gi, correct: "OrderVault" },
  { wrong: /\bexchange-router\b/gi, correct: "ExchangeRouter" },
  { wrong: /\bsynthetics-reader\b/gi, correct: "SyntheticsReader" },
  { wrong: /\bdata-store\b/gi, correct: "DataStore" },
]

const PASSIVE_VOICE_PATTERNS = [
  /\bis managed by\b/i,
  /\bwas created by\b/i,
  /\bare handled by\b/i,
  /\bcan be executed by\b/i,
  /\bwill be processed by\b/i,
]

/** Blanks out inline code spans and link targets/path-shaped labels, keeping
 * every other character's column position intact. The correct-capitalization
 * rule exists to catch prose mentions of these proper nouns; a route like
 * `/reference/synthetics-reader` or a URL like `stellar.expert` is neither —
 * it is required to be lowercase-kebab to work as a link or an identifier. */
function maskCodeAndLinks(line: string): string {
  const blank = (match: string) => " ".repeat(match.length)
  return line
    .replace(/`[^`]*`/g, blank)
    .replace(/\[(\/[^\]]*)\]/g, (_m, inner: string) => `[${" ".repeat(inner.length)}]`)
    .replace(/\]\(([^)]*)\)/g, (_m, inner: string) => `](${" ".repeat(inner.length)})`)
}

export function lintMarkdownContent(file: string, source: string): LintResult {
  const errors: LintMessage[] = []
  const warnings: LintMessage[] = []

  const lines = source.split("\n")
  let inCodeBlock = false
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i]

    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter
      continue
    }
    if (inFrontmatter) continue

    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Mask inline code spans, link targets, and HTML tags/elements with spaces to preserve column indices
    const proseLine = line
      .replace(/`[^`]+`/g, (m) => " ".repeat(m.length))
      .replace(/\]\([^)]+\)/g, (m) => "]" + " ".repeat(m.length - 1))
      .replace(/<[^>]+>/g, (m) => " ".repeat(m.length))

    // 1. Exclamation marks check (Error)
    const exclamIdx = proseLine.indexOf("!")
    if (exclamIdx !== -1 && !proseLine.match(/!=\s*/)) {
      errors.push({
        file,
        line: lineNum,
        column: exclamIdx + 1,
        rule: "no-exclamation-mark",
        message: "Exclamation marks are prohibited in documentation prose.",
        severity: "error",
      })
    }

    // 2. Banned words check (Error)
    for (const { word, reason } of BANNED_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, "gi")
      let match: RegExpExecArray | null
      while ((match = regex.exec(proseLine)) !== null) {
        errors.push({
          file,
          line: lineNum,
          column: match.index + 1,
          rule: "banned-words",
          message: `Forbidden word "${match[0]}": ${reason}`,
          severity: "error",
        })
      }
    }

    // 3. Product & protocol capitalization check (Error)
    const lineForCapsCheck = maskCodeAndLinks(line)
    for (const { wrong, correct } of REQUIRED_CAPITALIZATIONS) {
      let match: RegExpExecArray | null
      wrong.lastIndex = 0
      while ((match = wrong.exec(lineForCapsCheck)) !== null) {
        // Matches inside a code span or a link target/path-shaped label are
        // already blanked out by maskCodeAndLinks above.
        if (match[0] !== correct) {
          errors.push({
            file,
            line: lineNum,
            column: match.index + 1,
            rule: "correct-capitalization",
            message: `Incorrect capitalization "${match[0]}". Must be "${correct}".`,
            severity: "error",
          })
        }
      }
    }

    // 4. Passive voice check (Warning)
    for (const pattern of PASSIVE_VOICE_PATTERNS) {
      const match = pattern.exec(proseLine)
      if (match) {
        warnings.push({
          file,
          line: lineNum,
          column: match.index + 1,
          rule: "prefer-active-voice",
          message: `Consider active voice instead of passive "${match[0]}".`,
          severity: "warning",
        })
      }
    }

    // 5. Sentence length threshold (> 30 words) (Warning)
    const sentences = proseLine.split(/(?<=[.!?])\s+/)
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).filter(Boolean)
      if (words.length > 30) {
        warnings.push({
          file,
          line: lineNum,
          column: 1,
          rule: "sentence-length",
          message: `Sentence exceeds 30 words (${words.length} words). Consider breaking into shorter sentences.`,
          severity: "warning",
        })
      }
    }
  }

  return { file, errors, warnings }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? walk(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

export async function main() {
  const root = resolve(import.meta.dir, "..")
  const contentDir = join(root, "content")

  const mdxFiles = (await walk(contentDir)).filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))

  let totalErrors = 0
  let totalWarnings = 0

  for (const file of mdxFiles) {
    const source = await readFile(file, "utf8")
    const rel = relative(root, file)
    const result = lintMarkdownContent(rel, source)

    totalErrors += result.errors.length
    totalWarnings += result.warnings.length

    for (const err of result.errors) {
      console.error(`ERROR: ${err.file}:${err.line}:${err.column} — [${err.rule}] ${err.message}`)
    }
    for (const warn of result.warnings) {
      console.warn(`WARN:  ${warn.file}:${warn.line}:${warn.column} — [${warn.rule}] ${warn.message}`)
    }
  }

  console.log(`Prose lint complete: ${totalErrors} error(s), ${totalWarnings} warning(s).`)

  if (totalErrors > 0) {
    process.exit(1)
  }
}

const invokedDirectly = process.argv[1]?.endsWith("lint-prose.ts")
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
